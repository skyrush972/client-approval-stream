import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { STORAGE_PREFIX, useResolvedUrl } from "@/components/ProtectedPlayer";
import { R2_PREFIX } from "@/lib/r2.functions";

export type CarouselVideo = {
  id: string;
  title: string;
  kind: string;
  stream_url: string;
  duration?: string | null;
};

const HOVER_DELAY = 220;

/** Vignette du carrousel : aperçu muet lancé quand la souris reste dessus. */
function SequenceCard({
  video,
  index,
  total,
  isActive,
  token,
  onSelect,
}: {
  video: CarouselVideo;
  index: number;
  total: number;
  isActive: boolean;
  token?: string | undefined;
  onSelect: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isFile =
    video.stream_url.startsWith(R2_PREFIX) || video.stream_url.startsWith(STORAGE_PREFIX);
  // Toujours résolu pour les fichiers : la vignette affiche la première
  // image du rush (preload metadata), la lecture ne démarre qu'au survol.
  const resolved = useResolvedUrl(isFile ? video.stream_url : null, token);

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

  const onEnter = (e: ReactPointerEvent<HTMLButtonElement>) => {
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
      className="min-w-0 flex-[0_0_min(72vw,290px)] pl-4"
      aria-roledescription="diapositive"
      aria-label={`${index + 1} sur ${total} — ${video.title}`}
    >
      <button
        type="button"
        onClick={onSelect}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
        onFocus={onLeave}
        aria-current={isActive ? "true" : undefined}
        className="group block w-full text-left"
      >
        <span
          className={`film-frame relative block aspect-video overflow-hidden rounded-lg ring-1 transition-all duration-300 ${
            isActive
              ? "ring-accent/70 glow-accent"
              : "ring-border opacity-70 group-hover:opacity-100 group-hover:ring-accent/40"
          }`}
        >
          {resolved && (
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
          )}
          <span className="film-perf absolute inset-x-0 top-0 h-1.5 opacity-60" />
          <span className="film-perf absolute inset-x-0 bottom-0 h-1.5 opacity-60" />
          <span className="label-mono absolute left-3 top-3 z-10 text-accent">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="label-mono absolute right-3 top-3 z-10 text-muted-foreground">
            {video.kind === "rushs" ? "rushs" : "montage"}
          </span>
          <span
            className={`absolute inset-0 z-10 grid place-items-center transition-opacity duration-300 ${
              preview ? "opacity-0" : isActive ? "opacity-100" : "opacity-45 group-hover:opacity-100"
            }`}
          >
            <span className="grid size-11 place-items-center rounded-full bg-accent/90 text-accent-foreground">
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
        <span className="mt-3 block">
          <span
            className={`block truncate text-sm ${isActive ? "text-accent" : "text-foreground"}`}
          >
            {video.title}
          </span>
          <span className="label-mono mt-1 block text-muted-foreground">
            {video.duration ?? (video.kind === "rushs" ? "rushs" : "montage final")}
          </span>
        </span>
      </button>
    </div>
  );
}

/**
 * Carrousel horizontal des vidéos d'un projet (glisser, flèches, clavier).
 * Remplace la liste verticale côté client : chaque séquence devient une
 * vignette film qui se lit en aperçu muet au survol.
 */
export function VideoCarousel({
  videos,
  activeId,
  onSelect,
  token,
  heading = "Vos séquences",
}: {
  videos: CarouselVideo[];
  activeId: string | null | undefined;
  onSelect: (id: string) => void;
  token?: string | undefined;
  heading?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    dragFree: true,
    containScroll: "trimSnaps",
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrolledFor = useRef<string | null>(null);

  const sync = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
    setProgress(emblaApi.scrollProgress());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    sync();
    emblaApi.on("reInit", sync);
    emblaApi.on("scroll", sync);
    emblaApi.on("select", sync);
    return () => {
      emblaApi.off("reInit", sync);
      emblaApi.off("scroll", sync);
      emblaApi.off("select", sync);
    };
  }, [emblaApi, sync]);

  useEffect(() => {
    if (!emblaApi || !activeId || scrolledFor.current === activeId) return;
    scrolledFor.current = activeId;
    const index = videos.findIndex((v) => v.id === activeId);
    if (index > 0) emblaApi.scrollTo(index);
  }, [emblaApi, activeId, videos]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      emblaApi?.scrollPrev();
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      emblaApi?.scrollNext();
    }
  };

  if (videos.length === 0) {
    return (
      <p className="rounded-lg bg-surface px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border">
        Les vidéos apparaîtront ici dès leur mise en ligne.
      </p>
    );
  }

  const activeIndex = Math.max(
    0,
    videos.findIndex((v) => v.id === activeId),
  );
  const thumb = 100 / Math.max(videos.length, 5);

  return (
    <div
      role="group"
      aria-roledescription="carrousel"
      aria-label={heading}
      onKeyDown={onKey}
      className="no-select"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label-mono text-muted-foreground">{heading}</p>
          <p className="label-mono mt-2 text-accent">
            {String(activeIndex + 1).padStart(2, "0")}
            <span className="text-muted-foreground">
              {" "}
              / {String(videos.length).padStart(2, "0")}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Séquence précédente"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canPrev}
            className="grid size-9 place-items-center rounded-full bg-surface text-foreground ring-1 ring-border transition-opacity hover:ring-accent disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Séquence suivante"
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canNext}
            className="grid size-9 place-items-center rounded-full bg-surface text-foreground ring-1 ring-border transition-opacity hover:ring-accent disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div ref={emblaRef} className="mt-4 min-w-0 overflow-hidden">
        <div className="-ml-4 flex">
          {videos.map((v, i) => (
            <SequenceCard
              key={v.id}
              video={v}
              index={i}
              total={videos.length}
              isActive={activeId === v.id}
              token={token}
              onSelect={() => {
                onSelect(v.id);
                emblaApi?.scrollTo(i);
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative mt-5 h-px w-full bg-border">
        <div
          className="absolute top-1/2 h-px -translate-y-1/2 bg-accent transition-[left] duration-200"
          style={{
            width: `${thumb}%`,
            left: `${progress * (100 - thumb)}%`,
          }}
        />
      </div>
    </div>
  );
}
