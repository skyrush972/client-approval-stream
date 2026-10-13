import { useEffect, useMemo, useState, type Ref } from "react";
// Le logo est servi depuis le dossier public (indépendant de Lovable).
const logoAsset = { url: "/logo-skyrush.png" };
import { supabase } from "@/integrations/supabase/client";
import { getR2StreamUrl, R2_PREFIX } from "@/lib/r2.functions";
import { getShareStreamUrl } from "@/lib/share.functions";

export const STORAGE_PREFIX = "storage://rushs/";

export function useResolvedUrl(url: string | null | undefined, token?: string) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!url) {
      setResolved(null);
      return;
    }
    if (url.startsWith(R2_PREFIX)) {
      setResolved(null);
      void (token
        ? getShareStreamUrl({ data: { token, marker: url } })
        : getR2StreamUrl({ data: { marker: url } }))
        .then((r) => active && setResolved(r.url))
        .catch(() => active && setResolved(null));
      return () => {
        active = false;
      };
    }
    if (!url.startsWith(STORAGE_PREFIX)) {
      setResolved(url);
      return;
    }
    setResolved(null);
    void supabase.storage
      .from("rushs")
      .createSignedUrl(url.slice(STORAGE_PREFIX.length), 4 * 3600)
      .then(({ data }) => {
        if (active) setResolved(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [url, token]);
  return resolved;
}

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (host === "youtu.be") {
      return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?rel=0&modestbranding=1`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}?dnt=1&title=0&byline=0&portrait=0`;
    }
    if (host === "player.vimeo.com" || host.endsWith("frame.io") || host.endsWith("wistia.net")) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

export function ProtectedPlayer({
  url,
  title,
  token,
  autoPlay,
  videoRef,
}: {
  videoRef?: Ref<HTMLVideoElement> | undefined;
  url?: string | null | undefined;
  title?: string | undefined;
  token?: string | undefined;
  autoPlay?: boolean | undefined;
}) {
  const rawUrl = url;
  const resolvedUrl = useResolvedUrl(rawUrl, token);
  const isStorage = !!rawUrl?.startsWith(STORAGE_PREFIX) || !!rawUrl?.startsWith(R2_PREFIX);
  const embed = useMemo(
    () => (resolvedUrl && !isStorage ? toEmbedUrl(resolvedUrl) : null),
    [resolvedUrl, isStorage],
  );
  url = resolvedUrl;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
  }, [rawUrl]);
  const showEmblem = !embed && (!url || !ready);

  return (
    <div
      className="relative aspect-video overflow-hidden rounded-xl bg-ink ring-1 ring-border no-select"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-300 ${
          showEmblem ? "opacity-100" : "opacity-0"
        }`}
      >
        <img
          src={logoAsset.url}
          alt=""
          loading="lazy"
          className="w-16 opacity-20"
        />
      </div>
      {!url ? (
        <div className="relative z-10 grid h-full place-items-center">
          <p className="label-mono mt-24 text-ink-foreground/50">
            Aucune vidéo pour l'instant
          </p>
        </div>
      ) : embed ? (
        <iframe
          src={embed}
          title={title ?? "Lecture"}
          allow="autoplay; fullscreen; picture-in-picture"
          className="absolute inset-0 z-10 h-full w-full"
        />
      ) : (
        <video
          ref={videoRef}
          src={url}
          controls
          autoPlay={autoPlay}
          playsInline
          preload="auto"
          onLoadedData={() => setReady(true)}
          onCanPlay={() => setReady(true)}
          onPlaying={() => setReady(true)}
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          className="absolute inset-0 z-10 h-full w-full"
        />
      )}
      <span className="label-mono pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1 text-ink-foreground/60">
        Lecture en streaming · clic droit désactivé
      </span>
    </div>
  );
}
