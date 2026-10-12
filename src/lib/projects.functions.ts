import { createServerFn } from "@tanstack/react-start";
import { AwsClient } from "aws4fetch";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Administration des livraisons terminées : archivage réversible (la livraison
 * disparaît de l'espace client et son lien devient inactif) et suppression
 * définitive (les fichiers du stockage sont retirés en même temps).
 */

const R2_PREFIX = "r2://";

function r2Config() {
  const accountId = process.env["R2_ACCOUNT_ID"];
  const bucket = process.env["R2_BUCKET"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Le stockage des fichiers n'est pas configuré (identifiants R2 manquants).",
    );
  }
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

async function deleteR2Object(key: string): Promise<boolean> {
  const { accountId, bucket, accessKeyId, secretAccessKey } = r2Config();
  const client = new AwsClient({
    accessKeyId,
    secretAccessKey,
    region: "auto",
    service: "s3",
  });
  const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeURIComponent(
    key,
  ).replace(/%2F/g, "/")}`;
  const signed = await client.sign(url, { method: "DELETE", aws: { signQuery: true } });

  const response = await fetch(signed);
  return response.ok || response.status === 404;
}

export const setProjectArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), archived: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(`Vérification des droits impossible : ${roleError.message}`);
    if (!isAdmin) throw new Error("Réservé aux administrateurs.");

    const { data: project, error } = await context.supabase
      .from("projects")
      .select("id, title, client_name, archived_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(`Projet introuvable : ${error.message}`);
    if (!project) throw new Error("Ce projet n'existe plus.");

    const archivedAt = data.archived ? new Date().toISOString() : null;
    const { error: updateError } = await context.supabase
      .from("projects")
      .update({ archived_at: archivedAt })
      .eq("id", data.id);
    if (updateError) throw new Error(`Archivage impossible : ${updateError.message}`);

    return {
      archived: data.archived,
      title: project.title,
      clientName: project.client_name,
      alreadyArchived: !!project.archived_at === data.archived,
    };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error(`Vérification des droits impossible : ${roleError.message}`);
    if (!isAdmin) throw new Error("Réservé aux administrateurs.");

    const { data: project } = await context.supabase
      .from("projects")
      .select("id, title, archived_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!project) throw new Error("Ce projet n'existe plus.");

    // On retire d'abord les fichiers du stockage, puis la livraison.
    const { data: videos, error: videosError } = await context.supabase
      .from("videos")
      .select("stream_url, download_url")
      .eq("project_id", data.id);
    if (videosError) throw new Error(`Lecture des fichiers impossible : ${videosError.message}`);

    const keys = Array.from(
      new Set(
        (videos ?? [])
          .flatMap((video) => [video.stream_url, video.download_url])
          .filter((url): url is string => !!url && url.startsWith(R2_PREFIX))
          .map((url) => url.slice(R2_PREFIX.length)),
      ),
    );

    let removed = 0;
    for (const key of keys) {
      if (await deleteR2Object(key)) removed += 1;
    }

    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(`Suppression impossible : ${error.message}`);

    return { files: keys.length, removed, title: project.title };
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Réservé aux administrateurs.");

    const { data: video } = await context.supabase
      .from("videos")
      .select("id, title, stream_url, download_url")
      .eq("id", data.id)
      .maybeSingle();
    if (!video) throw new Error("Cette vidéo n'existe plus.");

    const keys = Array.from(
      new Set(
        [video.stream_url, video.download_url]
          .filter((url): url is string => !!url && url.startsWith(R2_PREFIX))
          .map((url) => url.slice(R2_PREFIX.length)),
      ),
    );
    for (const key of keys) {
      try {
        await deleteR2Object(key);
      } catch {
        /* le fichier sera orphelin, la vidéo est tout de même retirée */
      }
    }

    const { error } = await context.supabase.from("videos").delete().eq("id", data.id);
    if (error) throw new Error(`Suppression impossible : ${error.message}`);
    return { title: video.title };
  });

export const sendClientLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accès refusé");
    const { data: p, error } = await supabaseAdmin
      .from("projects")
      .select("id, client_name, client_email, title, share_token")
      .eq("id", data.id)
      .single();
    if (error || !p) throw new Error("Projet introuvable");
    const link = `https://client.skyrush972.fr/lien/${p.share_token}`;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const r = await sendTemplateEmail("client-delivery-link", p.client_email, {
      templateData: { clientName: p.client_name, projectTitle: p.title, link },
      idempotencyKey: `client-delivery-link-${p.id}-${Date.now()}`,
      replyTo: "skyrush972@hotmail.com",
    });
    return { sent: r.sent, email: p.client_email, link };
  });
