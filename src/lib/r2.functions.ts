import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const R2_PREFIX = "r2://";

async function signer() {
  const { AwsClient } = await import("aws4fetch");
  const accountId = process.env["R2_ACCOUNT_ID"];
  const bucket = process.env["R2_BUCKET"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Stockage Cloudflare R2 non configuré");
  }
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
  return async (key: string, method: "GET" | "PUT", expires: number, extra?: Record<string, string>) => {
    const url = new URL(`${base}/${key.split("/").map(encodeURIComponent).join("/")}`);
    url.searchParams.set("X-Amz-Expires", String(expires));
    for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
    const signed = await client.sign(url.toString(), { method, aws: { signQuery: true } });
    return signed.url;
  };
}

export const getR2UploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ projectId: z.string().uuid(), fileName: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accès refusé");
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${data.projectId}/${Date.now()}-${safe}`;
    const sign = await signer();
    return { uploadUrl: await sign(key, "PUT", 6 * 3600), marker: `${R2_PREFIX}${key}` };
  });

export const getR2StreamUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ marker: z.string().startsWith(R2_PREFIX) }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: only returns the row if the caller may see this video
    const { data: row } = await context.supabase
      .from("videos")
      .select("id")
      .eq("stream_url", data.marker)
      .limit(1)
      .maybeSingle();
    if (!row) throw new Error("Vidéo inaccessible");
    const sign = await signer();
    return { url: await sign(data.marker.slice(R2_PREFIX.length), "GET", 4 * 3600) };
  });

export const getR2DownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ videoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // get_download_url only returns a value for admins or paid projects
    const { data: marker, error } = await context.supabase.rpc("get_download_url", {
      _video_id: data.videoId,
    });
    if (error) throw new Error(error.message);
    if (!marker || !marker.startsWith(R2_PREFIX)) return { url: null };
    const key = marker.slice(R2_PREFIX.length);
    const name = key.split("/").pop() ?? "video";
    const sign = await signer();
    return {
      url: await sign(key, "GET", 3600, {
        "response-content-disposition": `attachment; filename="${name}"`,
      }),
    };
  });
