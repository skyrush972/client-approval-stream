import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { BRAND_NAME } from "@/lib/brand";
import heroAerial from "@/assets/hero-aerial.jpg";

export const Route = createFileRoute("/espace")({
  head: () => ({
    meta: [
      { title: "Vos projets vidéo — espace client privé" },
      {
        name: "description",
        content:
          "Retrouvez vos projets vidéo : visionnage en streaming, retours écrits et téléchargement une fois le paiement validé.",
      },
      { property: "og:title", content: "Vos projets vidéo — espace client privé" },
      {
        property: "og:description",
        content: "Visionnage en streaming, retours écrits et téléchargement après validation.",
      },
    ],
  }),
  component: ClientProjectsPage,
});

type Project = {
  id: string;
  client_name: string;
  title: string;
  is_paid: boolean;
  created_at: string;
};

function ClientProjectsPage() {
  const { session, role, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/" });
  }, [loading, session, navigate]);

  const projectsQuery = useQuery({
    queryKey: ["client-projects"],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, client_name, title, is_paid, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const projects = projectsQuery.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* hero — façon portfolio */}
      <section className="relative overflow-hidden">
        <img
          src={heroAerial}
          alt="Survol de la Martinique par drone"
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/40 to-background" />

        <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4 py-6">
            <BrandMark tone="dark" subtitle="Espace client" />
            <div className="flex items-center gap-4">
              {role === "admin" && (
                <Link to="/admin" className="label-mono text-accent">
                  Console admin
                </Link>
              )}
              <button
                onClick={() => {
                  void signOut().then(() => navigate({ to: "/" }));
                }}
                className="label-mono text-ink-foreground/60 hover:text-ink-foreground"
              >
                Déconnexion
              </button>
            </div>
          </header>

          <div className="rise-in py-20 text-center sm:py-28">
            <p className="label-mono text-accent">— {BRAND_NAME} · Livraisons privées</p>
            <h1 className="title-display mt-4 text-4xl leading-[1.1] text-ink-foreground sm:text-6xl">
              Vos images,
              <br />
              <span className="title-italic">prises de haut.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-pretty text-sm text-ink-foreground/70">
              Visionnez vos rushs et montages en streaming, laissez vos retours, et récupérez
              les fichiers originaux une fois le paiement validé.
            </p>
          </div>
        </div>
      </section>

      {/* projets */}
      <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-8">
        <div className="flex items-end justify-between">
          <p className="label-mono text-muted-foreground">Vos livraisons</p>
          <p className="label-mono text-muted-foreground">
            {projects.length} projet{projects.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {projectsQuery.isLoading && (
            <p className="label-mono text-muted-foreground">Chargement…</p>
          )}
          {!projectsQuery.isLoading && projects.length === 0 && (
            <div className="rounded-xl bg-surface p-6 ring-1 ring-border">
              <p className="text-sm text-foreground">
                Aucun projet n'est encore associé à votre adresse email.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Dès qu'une livraison est prête, elle apparaîtra ici.
              </p>
            </div>
          )}
          {projects.map((p, i) => (
            <Link
              key={p.id}
              to="/espace/projet/$id"
              params={{ id: p.id }}
              className="group flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface p-5 ring-1 ring-border transition-all hover:-translate-y-0.5 hover:ring-accent/40"
            >
              <div className="flex items-center gap-5">
                <span className="font-mono text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="title-display text-xl text-foreground">{p.title}</p>
                  <p className="label-mono mt-1 text-muted-foreground">{p.client_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    p.is_paid ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
                  }`}
                >
                  {p.is_paid ? "Téléchargement débloqué" : "Téléchargement verrouillé"}
                </span>
                <span className="label-mono text-muted-foreground transition-colors group-hover:text-accent">
                  Voir →
                </span>
              </div>
            </Link>
          ))}
        </div>

        <p className="label-mono mt-12 text-center text-muted-foreground/60">
          Session sécurisée · {BRAND_NAME}
        </p>
      </section>
    </div>
  );
}
