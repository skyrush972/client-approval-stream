import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { ProtectedPlayer, STORAGE_PREFIX } from "@/components/ProtectedPlayer";
import { VideoCarousel } from "@/components/VideoCarousel";
import { getR2DownloadUrl, R2_PREFIX } from "@/lib/r2.functions";

export const Route = createFileRoute("/espace/projet/$id")({
  head: () => ({
    meta: [
      { title: "Votre livraison vidéo — lecture et retours" },
      {
        name: "description",
        content:
          "Visionnez vos rushs et votre montage final en streaming, laissez vos retours et téléchargez les fichiers une fois le paiement validé.",
      },
      { property: "og:title", content: "Votre livraison vidéo — lecture et retours" },
      {
        property: "og:description",
        content:
          "Visionnage en streaming, retours écrits et téléchargement débloqué après validation du paiement.",
      },
    ],
  }),
  component: ClientProjectPage,
});

type Project = {
  id: string;
  client_name: string;
  title: string;
  is_paid: boolean;
};

type Video = {
  id: string;
  title: string;
  kind: "rushs" | "final";
  stream_url: string;
  duration: string | null;
};

type Comment = {
  id: string;
  body: string;
  author_name: string;
  author_id: string;
  created_at: string;
};

function ClientProjectPage() {
  const { id } = Route.useParams();
  const { session, loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const projectQuery = useQuery({
    queryKey: ["client-project", id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, client_name, title, is_paid")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
  });

  const videosQuery = useQuery({
    queryKey: ["client-videos", id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, kind, stream_url, duration")
        .eq("project_id", id)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as Video[];
    },
  });

  const commentsQuery = useQuery({
    queryKey: ["client-comments", id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, body, author_name, author_id, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Comment[];
    },
  });

  const addComment = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("comments").insert({
        project_id: id,
        video_id: activeVideo,
        author_id: user!.id,
        author_name:
          (user?.user_metadata?.["display_name"] as string | undefined) ??
          user?.email?.split("@")[0] ??
          "Client",
        body: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      void qc.invalidateQueries({ queryKey: ["client-comments", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const project = projectQuery.data;
  const videos = videosQuery.data ?? [];
  const current = videos.find((v) => v.id === activeVideo) ?? videos[0] ?? null;
  const unlocked = !!project?.is_paid;

  const handleDownload = async () => {
    const targets = videos.length ? videos : [];
    let opened = 0;
    for (const v of targets) {
      if (v.stream_url.startsWith(R2_PREFIX)) {
        try {
          const r = await getR2DownloadUrl({ data: { videoId: v.id } });
          if (r.url) {
            window.open(r.url, "_blank", "noopener,noreferrer");
            opened += 1;
          }
        } catch (e) {
          toast.error((e as Error).message);
        }
        continue;
      }
      const { data, error } = await supabase.rpc("get_download_url", { _video_id: v.id });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data) {
        let href: string = data;
        if (data.startsWith(STORAGE_PREFIX)) {
          const path = data.slice(STORAGE_PREFIX.length);
          const { data: s } = await supabase.storage
            .from("rushs")
            .createSignedUrl(path, 3600, { download: true });
          if (!s?.signedUrl) continue;
          href = s.signedUrl;
        }
        window.open(href, "_blank", "noopener,noreferrer");
        opened += 1;
      }
    }
    if (opened === 0) toast.error("Aucun fichier de téléchargement n'est encore disponible.");
  };

  if (loading || projectQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="label-mono text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="text-center">
          <h1 className="title-display text-2xl text-foreground">Projet indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce projet n'existe pas ou n'est pas associé à votre accès.
          </p>
          <Link to="/espace" className="label-mono mt-4 inline-block text-accent">
            Retour à vos projets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
          <BrandMark subtitle={`Espace client · ${project.client_name}`} />
          <div className="flex items-center gap-4">
            <Link to="/espace" className="label-mono text-muted-foreground hover:text-foreground">
              Vos projets
            </Link>
            <button
              onClick={() => {
                void signOut().then(() => navigate({ to: "/" }));
              }}
              className="label-mono text-muted-foreground hover:text-foreground"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <div className="mt-8 grid grid-cols-12 gap-8">
          {/* player + comments */}
          <div className="col-span-12 min-w-0 lg:col-span-8">
            <p className="label-mono mb-2 text-accent">— Livraison · {project.client_name}</p>
            <h1 className="title-display mb-4 text-3xl text-foreground sm:text-4xl">
              {project.title}
            </h1>
            <p className="mb-6 max-w-2xl text-sm text-pretty text-muted-foreground">
              Regardez vos vidéos, laissez vos commentaires, puis téléchargez vos fichiers une
              fois la livraison validée.
            </p>
            <ProtectedPlayer url={current?.stream_url} title={current?.title} />

            <div className="mt-8">
              <VideoCarousel
                videos={videos}
                activeId={current?.id}
                onSelect={(id) => setActiveVideo(id)}
                heading="Vos rushs & livrables"
              />
            </div>

            <div className="mt-8">
              <p className="label-mono mb-4 text-muted-foreground">Commentaires</p>
              <div className="space-y-4">
                {(commentsQuery.data ?? []).map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                      {(c.author_name || "?").slice(0, 2).toUpperCase()}
                    </span>
                    <div className="flex-1 rounded-xl bg-surface p-4 ring-1 ring-border">
                      <p className="mb-1 text-xs text-muted-foreground">
                        {c.author_id === user?.id ? "Vous" : c.author_name} ·{" "}
                        {new Date(c.created_at).toLocaleString("fr-FR")}
                      </p>
                      <p className="text-sm text-pretty text-foreground">{c.body}</p>
                    </div>
                  </div>
                ))}
                {(commentsQuery.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Soyez le premier à laisser un retour sur cette livraison.
                  </p>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!body.trim()) return;
                  addComment.mutate(body.trim().slice(0, 1000));
                }}
                className="mt-4 flex gap-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                  {(user?.email ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 rounded-xl bg-surface p-3 ring-1 ring-border">
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Écrire un commentaire…"
                    className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={addComment.isPending}
                      className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-ink-foreground disabled:opacity-50"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* sidebar */}
          <aside className="col-span-12 min-w-0 lg:col-span-4">
            <div className="rounded-xl bg-surface p-5 ring-1 ring-border">
              <p className="label-mono mb-4 text-muted-foreground">Vos fichiers</p>


              <div className="mt-6 rounded-lg bg-ink p-4 ring-1 ring-border">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-accent/20">
                    <span className="size-2 rounded-sm bg-accent" />
                  </span>
                  <p className="label-mono text-accent">
                    {unlocked ? "Téléchargement débloqué" : "Téléchargement verrouillé"}
                  </p>
                </div>
                <p className="mb-4 text-sm text-pretty text-ink-foreground/70">
                  {unlocked
                    ? "Le paiement est validé : vous pouvez récupérer les fichiers originaux."
                    : "Le téléchargement se déverrouille dès que le paiement est validé par Skyrush972."}
                </p>
                <button
                  disabled={!unlocked}
                  onClick={() => void handleDownload()}
                  className={
                    unlocked
                      ? "w-full rounded-md bg-accent py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                      : "no-select w-full cursor-not-allowed rounded-md bg-ink-foreground/10 py-3 text-sm font-medium text-ink-foreground/40"
                  }
                >
                  Télécharger les fichiers
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
