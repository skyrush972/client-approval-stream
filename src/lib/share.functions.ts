import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const R2 = "r2://";
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function projectByToken(token: string) {
  const db = await admin();
  const { data } = await db
    .from("projects")
    .select("id, client_name, title, is_paid, archived_at")
    .eq("share_token", token)
    .maybeSingle();
  if (!data) throw new Error("Lien invalide ou expiré");
  if (data.archived_at) throw new Error("Cette livraison a été archivée par le prestataire.");
  return { db, project: data };
}


async function sign(key: string, expires: number, extra?: Record<string, string>) {
  const { AwsClient } = await import("aws4fetch");
  const client = new AwsClient({
    accessKeyId: process.env["R2_ACCESS_KEY_ID"]!,
    secretAccessKey: process.env["R2_SECRET_ACCESS_KEY"]!,
    service: "s3",
    region: "auto",
  });
  const url = new URL(
    `https://${process.env["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com/${process.env["R2_BUCKET"]}/${key
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
  );
  url.searchParams.set("X-Amz-Expires", String(expires));
  for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
  return (await client.sign(url.toString(), { method: "GET", aws: { signQuery: true } })).url;
}

export const getSharedProject = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema }).parse(d))
  .handler(async ({ data }) => {
    const { db, project } = await projectByToken(data.token);
    const [{ data: videos }, { data: comments }] = await Promise.all([
      db
        .from("videos")
        .select("id, title, kind, stream_url, duration")
        .eq("project_id", project.id)
        .order("position"),
      db
        .from("comments")
        .select("id, body, author_name, created_at, video_id, timecode")
        .eq("project_id", project.id)
        .order("created_at"),
    ]);
    return { project, videos: videos ?? [], comments: comments ?? [] };
  });

export const getShareStreamUrl = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ token: tokenSchema, marker: z.string().startsWith(R2) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { db, project } = await projectByToken(data.token);
    const { data: v } = await db
      .from("videos")
      .select("id")
      .eq("project_id", project.id)
      .eq("stream_url", data.marker)
      .limit(1)
      .maybeSingle();
    if (!v) throw new Error("Vidéo inaccessible");
    return { url: await sign(data.marker.slice(R2.length), 4 * 3600) };
  });

export const postShareComment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: tokenSchema,
        name: z.string().trim().min(1).max(80),
        body: z.string().trim().min(1).max(2000),
        videoId: z.string().uuid().nullable(),
        timecode: z.number().min(0).max(86400).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { db, project } = await projectByToken(data.token);
    const { data: row, error } = await db.from("comments").insert({
      project_id: project.id,
      video_id: data.videoId,
      author_id: null,
      author_name: data.name,
      body: data.body,
      timecode: data.timecode ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const t = data.timecode;
      const tc = t != null ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}` : undefined;
      await sendTemplateEmail("new-comment-alert", "skyrush972@hotmail.com", {
        templateData: { authorName: data.name, clientName: project.client_name, projectTitle: project.title, body: data.body, timecode: tc },
        idempotencyKey: `new-comment-alert-${row.id}`,
      });
    } catch (e) {
      console.error("alert email failed", e);
    }
    return { ok: true };
  });

export const getShareDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: tokenSchema, videoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { db, project } = await projectByToken(data.token);
    if (!project.is_paid) return { url: null };
    const { data: v } = await db
      .from("videos")
      .select("download_url, stream_url")
      .eq("id", data.videoId)
      .eq("project_id", project.id)
      .maybeSingle();
    const marker = v?.download_url ?? v?.stream_url ?? null;
    if (!marker) return { url: null };
    if (!marker.startsWith(R2)) return { url: marker };
    const key = marker.slice(R2.length);
    const name = key.split("/").pop() ?? "video";
    return {
      url: await sign(key, 3600, { "response-content-disposition": `attachment; filename="${name}"` }),
    };
  });
