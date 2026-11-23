import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { ProtectedPlayer } from "@/components/ProtectedPlayer";
import { VideoCarousel } from "@/components/VideoCarousel";
import { getSharedProject, getShareDownloadUrl, postShareComment } from "@/lib/share.functions";

export const Route = createFileRoute("/lien/$token")({
  head: () => ({
    meta: [
      { title: "Votre livraison vidéo — Skyrush972" },
      { name: "description", content: "Visionnez vos rushs et laissez vos retours à Skyrush972." },
      { property: "og:title", content: "Votre livraison vidéo — Skyrush972" },
      { property: "og:description", content: "Visionnez vos rushs et laissez vos retours." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stamp, setStamp] = useState<number | null>(null);
  const [useStamp, setUseStamp] = useState(true);

  useEffect(() => {
    setName(localStorage.getItem("skyrush-name") ?? "");
  }, []);

  const q = useQuery({
    queryKey: ["share", token],
    queryFn: () => getSharedProject({ data: { token } }),
    retry: false,
  });

  const send = useMutation({
    mutationFn: () =>
      postShareComment({ data: { token, name, body, videoId: current?.id ?? null, timecode: useStamp ? stamp : null } }),
    onSuccess: () => {
      localStorage.setItem("skyrush-name", name);
      setBody("");
      setStamp(null);
      void qc.invalidateQueries({ queryKey: ["share", token] });
      toast.success("Commentaire envoyé");
    },
    onError: () => toast.error("Impossible d'envoyer le commentaire"),
  });

  if (q.isLoading) return <div className="min-h-screen bg-background" />;
  if (q.isError || !q.data)
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <BrandMark />
          <p className="mt-6 text-muted-foreground">Ce lien n'est pas valide.</p>
        </div>
      </div>
    );

  const { project, videos, comments } = q.data;
  const current = videos.find((v) => v.id === active) ?? videos[0] ?? null;

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    void v.play().catch(() => {});
  };

  const download = async () => {
    if (!current) return;
    const r = await getShareDownloadUrl({ data: { token, videoId: current.id } });
    if (r.url) window.open(r.url, "_blank", "noopener,noreferrer");
    else toast.error("Téléchargement pas encore disponible");
  };

  return (
    <div className="ambient min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 lg:px-12">
        <BrandMark />
        <span className="label-mono flex items-center gap-2 rounded-full border border-accent/30 bg-ink/60 px-4 py-2 text-accent">
          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
          Livraison privée
        </span>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20 lg:px-12">
        <p className="label-mono rise-in text-accent">— Livraison · {project.client_name}</p>
        <h1 className="title-display rise-in mt-3 text-5xl leading-[1.05] lg:text-8xl">
          <span className="title-italic glitch" data-text={project.title}>
            {project.title}
          </span>
        </h1>
        <div className="mt-6 h-px w-24 bg-gradient-to-r from-accent to-transparent" />
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground">
          Regardez vos vidéos, laissez vos commentaires à l'instant précis qui vous interpelle,
          puis téléchargez vos fichiers une fois la livraison validée.
        </p>

        <div
          aria-hidden
          className="-mx-6 mt-10 overflow-hidden border-y border-accent/25 py-4 whitespace-nowrap lg:-mx-12"
        >
          <div className="marquee-track title-display inline-flex gap-12 text-2xl text-accent/70 italic">
            {[0, 1, 2, 3].map((k) => (
              <span key={k} className="inline-flex gap-12">
                <span>Skyrush972</span>
                <span className="text-accent">✦</span>
                <span>Cinéma aérien</span>
                <span className="text-accent">✦</span>
                <span>Martinique</span>
                <span className="text-accent">✦</span>
                <span>Prises de vues FPV</span>
                <span className="text-accent">✦</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <ProtectedPlayer videoRef={videoRef} key={current?.id} url={current?.stream_url} title={current?.title} token={token} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="title-display text-xl">{current?.title ?? "—"}</p>
              <div className="text-right">
                <button
                  onClick={() => void download()}
                  disabled={!project.is_paid || !current}
                  className="btn-gold rounded-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {project.is_paid ? "Télécharger" : "🔒 Téléchargement verrouillé"}
                </button>
                {!project.is_paid && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Disponible une fois le paiement effectué par Skyrush972.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-10">
              <VideoCarousel
                videos={videos}
                activeId={current?.id}
                onSelect={(id) => setActive(id)}
                token={token}
                heading="Vos rushs & livrables"
              />
            </div>
          </div>

          <aside className="min-w-0 lg:col-span-4">
            <p className="title-display mb-4 text-3xl">
              Vos <span className="title-italic">retours</span>
            </p>
            <div className="max-h-[420px] space-y-3 overflow-y-auto">
              {comments.map((c, i) => (
                <div
                  key={c.id}
                  style={{ animationDelay: `${Math.min(i, 6) * 0.1}s` }}
                  className="whip-in glass lift rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="label-mono text-accent">{c.author_name}</p>
                    {c.timecode != null && (
                      <button
                        type="button"
                        title="Aller à cet instant"
                        onClick={() => {
                          if (c.video_id && c.video_id !== current?.id) {
                            setActive(c.video_id);
                            setTimeout(() => seek(Number(c.timecode)), 600);
                          } else seek(Number(c.timecode));
                        }}
                        className="label-mono rounded-full bg-accent/15 px-2 py-0.5 text-accent hover:bg-accent/25"
                      >
                        ▶ {fmt(Number(c.timecode))}
                      </button>
                    )}
                  </div>
                  {c.video_id && c.video_id !== current?.id && (
                    <p className="text-xs text-muted-foreground">{videos.find((v) => v.id === c.video_id)?.title}</p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed">{c.body}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="rounded-lg bg-surface p-4 text-sm text-muted-foreground ring-1 ring-border">
                  Soyez le premier à laisser un retour — votre commentaire peut être lié à
                  l'instant précis de la vidéo.
                </p>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim() && body.trim()) send.mutate();
              }}
              className="mt-4 space-y-2"
            >
              <input
                required
                placeholder="Votre nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-ink/60 px-4 py-3 text-sm ring-1 ring-accent/25 outline-none focus:ring-2 focus:ring-accent"
              />
              <textarea
                required
                rows={3}
                placeholder={current ? `Commentaire sur « ${current.title} »` : "Votre commentaire"}
                value={body}
                onFocus={() => {
                  if (stamp == null && videoRef.current) setStamp(videoRef.current.currentTime);
                }}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-xl bg-ink/60 px-4 py-3 text-sm ring-1 ring-accent/25 outline-none focus:ring-2 focus:ring-accent"
              />
              {stamp != null && useStamp ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm ring-1 ring-accent/25">
                  <p className="text-pretty">
                    Votre commentaire sera lié à l'instant{" "}
                    <span className="label-mono text-accent">{fmt(stamp)}</span> de la vidéo.
                  </p>
                  <span className="flex shrink-0 gap-3">
                    <button
                      type="button"
                      onClick={() => videoRef.current && setStamp(videoRef.current.currentTime)}
                      className="label-mono text-muted-foreground hover:text-accent"
                    >
                      Actualiser
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseStamp(false)}
                      className="label-mono text-muted-foreground hover:text-accent"
                    >
                      Retirer
                    </button>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (videoRef.current) setStamp(videoRef.current.currentTime);
                    setUseStamp(true);
                  }}
                  className="label-mono text-muted-foreground hover:text-accent"
                >
                  + Lier à l'instant de la vidéo
                </button>
              )}
              <button
                disabled={send.isPending}
                className="btn-gold w-full rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-50"
              >
                Envoyer
              </button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}

function fmt(t: number) {
  const s = Math.floor(t);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
