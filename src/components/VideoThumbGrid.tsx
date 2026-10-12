import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Play, Trash2 } from "lucide-react";
import { STORAGE_PREFIX, useResolvedUrl } from "@/components/ProtectedPlayer";
import { R2_PREFIX } from "@/lib/r2.functions";

export type ThumbVideo = {
  id: string;
  title: string;
  kind: string;
  stream_url: string;
  duration?: string | null;
};

const HOVER_DELAY = 220;

/**
 * Vignette de la console : la première image du rush sert de miniature,
 * l'aperçu muet se lance au survol, un clic ouvre la séquence dans le lecteur.
 */
function Thumb({
  video,
  index,
  isActive,
  onSelect,
  onDelete,
}: {
  video: ThumbVideo;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isFile =
    video.stream_url.startsWith(R2_PREFIX) || video.stream_url.startsWith(STORAGE_PREFIX);
  const resolved = useResolvedUrl(isFile ? video.stream_url : null);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => clear, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (preview) {
      void el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [preview]);

  const onEnter = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !isFile || preview) return;
    clear();
    timer.current = setTimeout(() => setPreview(true), HOVER_DELAY);
  };

  const onLeave = () => {
    clear();
    setPreview(false);
  };

  return (
    <div
      className="group relative min-w-0"
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      <button
        type="button"
        onClick={onSelect}
        onFocus={onLeave}
        aria-current={isActive ? "true" : undefined}
        className="block w-full text-left"
      >
        <span
          className={`film-frame relative block aspect-video overflow-hidden rounded-lg ring-1 transition-all duration-300 ${
            isActive
              ? "ring-accent/70 glow-accent"
              : "ring-ink-foreground/10 opacity-75 group-hover:opacity-100 group-hover:ring-accent/40"
          }`}
        >
          {resolved ? (
            <video
              ref={videoRef}
              src={resolved}
              muted
              loop
              playsInline
              preload="metadata"
              onContextMenu={(e) => e.preventDefault()}
              className="absolute inset-0 h-full w-full bg-ink object-cover"
            />
          ) : (
            <span className="absolute inset-0 bg-ink" />
          )}
          <span className="film-perf absolute inset-x-0 top-0 h-1.5 opacity-60" />
          <span className="film-perf absolute inset-x-0 bottom-0 h-1.5 opacity-60" />
          <span className="label-mono absolute left-3 top-3 z-10 text-accent">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span
            className={`absolute inset-0 z-10 grid place-items-center transition-opacity duration-300 ${
              preview ? "opacity-0" : isActive ? "opacity-100" : "opacity-45 group-hover:opacity-100"
            }`}
          >
            <span className="grid size-10 place-items-center rounded-full bg-accent/90 text-accent-foreground">
              {isActive ? (
                <span className="flex items-end gap-0.5" aria-hidden="true">
                  <span className="size-1 animate-pulse rounded-full bg-accent-foreground" />
                  <span className="size-1 animate-pulse rounded-full bg-accent-foreground [animation-delay:150ms]" />
                  <span className="size-1 animate-pulse rounded-full bg-accent-foreground [animation-delay:300ms]" />
                </span>
              ) : (
                <Play className="size-4 fill-current" />
              )}
            </span>
          </span>
          {preview && (
            <span className="label-mono absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-ink/75 px-2.5 py-1 text-ink-foreground/70">
              Aperçu
            </span>
          )}
        </span>
        <span className="mt-2 block">
          <span
            className={`block truncate text-sm ${isActive ? "text-accent" : "text-ink-foreground"}`}
          >
            {video.title}
          </span>
          <span className="label-mono mt-1 block text-ink-foreground/40">
            {video.kind === "rushs" ? "rushs" : "montage"}
            <span className="mx-1.5 opacity-40">·</span>
            {video.duration ?? "—"}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Supprimer ${video.title}`}
        title="Supprimer cette vidéo"
        className="absolute right-2 top-2 z-20 grid size-8 place-items-center rounded-full bg-ink/85 text-ink-foreground/80 ring-1 ring-ink-foreground/20 transition-all hover:bg-destructive hover:text-destructive-foreground"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

/**
 * Grille de vignettes pour la console admin : remplace la liste texte des
 * rushs par une planche de miniatures, chacune lisible en aperçu au survol.
 */
export function VideoThumbGrid({
  videos,
  activeId,
  onSelect,
  onDelete,
}: {
  videos: ThumbVideo[];
  activeId: string | null | undefined;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (videos.length === 0) {
    return (
      <p className="rounded-lg bg-ink-foreground/5 px-4 py-6 text-center text-sm text-ink-foreground/50 ring-1 ring-ink-foreground/10">
        Aucune vidéo pour l'instant — déposez vos rushs ci-dessous.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {videos.map((v, i) => (
        <Thumb
          key={v.id}
          video={v}
          index={i}
          isActive={activeId === v.id}
          onSelect={() => onSelect(v.id)}
          onDelete={() => onDelete(v.id)}
        />
      ))}
    </div>
  );
}
