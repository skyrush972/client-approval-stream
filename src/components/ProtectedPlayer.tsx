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
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    setReady(false);
    setPlaying(false);
  }, [rawUrl]);
  const showEmblem = !embed && (!url || !ready);

  return (
    <div
      className="relative aspect-video overflow-hidden rounded-3xl bg-ink ring-1 ring-accent/35 shadow-[0_50px_100px_-50px_rgba(0,0,0,1),0_0_120px_-50px_rgba(232,184,90,0.45)] no-select"
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
          onPlaying={() => {
            setReady(true);
            setPlaying(true);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          className="absolute inset-0 z-10 h-full w-full"
        />
      )}
      {/* Habillage caméra / FPV : visible à l'arrêt, s'efface pendant la lecture pour ne pas gêner l'image. */}
      {!embed && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-500 ${
            playing ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.14)_0px,rgba(0,0,0,0.14)_1px,transparent_1px,transparent_3px)] mix-blend-multiply" />
          <div className="hud-scan absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
          <div className="absolute inset-0 overflow-hidden">
            <div className="hud-streak absolute top-[22%] left-0 h-px w-[38%] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
            <div className="hud-streak absolute top-[63%] left-0 h-px w-[44%] bg-gradient-to-r from-transparent via-white/70 to-transparent [animation-delay:1.3s]" />
          </div>
          <span className="absolute top-4 left-4 size-7 border-t border-l border-accent" />
          <span className="absolute top-4 right-4 size-7 border-t border-r border-accent" />
          <span className="absolute bottom-4 left-4 size-7 border-b border-l border-accent" />
          <span className="absolute right-4 bottom-4 size-7 border-r border-b border-accent" />
          <div className="osd absolute top-5 left-14 flex items-center gap-2 text-[11px] text-white">
            <span className="hud-blink size-2.5 rounded-full bg-[#ff4d4d] shadow-[0_0_10px_#ff4d4d]" />
            REC
          </div>
          <div className="osd absolute top-4 left-1/2 hidden -translate-x-1/2 gap-5 rounded-md border border-accent/35 bg-ink/45 px-4 py-1.5 text-[10px] text-white sm:flex">
            <span>MODE ACRO</span>
            <span className="text-accent">5.8G</span>
            <span>LQ 100</span>
          </div>
          <div className="hud-roll absolute top-[46%] left-1/2 h-0 w-0">
            <span className="absolute -left-40 h-px w-24 bg-accent/70" />
            <span className="absolute left-16 h-px w-24 bg-accent/70" />
          </div>
        </div>
      )}
      <span
        className={`label-mono pointer-events-none absolute top-4 right-14 z-20 hidden rounded-full bg-ink/60 px-3 py-1 text-ink-foreground/70 transition-opacity duration-500 sm:block ${
          playing ? "opacity-0" : "opacity-100"
        }`}
      >
        Streaming protégé
      </span>
    </div>
  );
}
