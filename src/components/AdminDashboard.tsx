import { useMemo } from "react";
import {
  Film,
  MessageSquare,
  Plus,
  ShieldCheck,
  FolderKanban,
} from "lucide-react";

export type ProjectRow = {
  id: string;
  client_name: string;
  client_email: string;
  title: string;
  is_paid: boolean;
  archived_at: string | null;
  created_at: string;
};

export type OverviewVideo = {
  project_id: string;
  kind: string;
  stream_url: string;
  created_at: string;
};

export type OverviewComment = {
  id: string;
  project_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
  resolved_at: string | null;
};

/**
 * Carte KPI « médaillon » : icône dans un médaillon verre fumé cerclé d'or,
 * chiffre serif Playfair, halo doré au survol.
 */
function Stat({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-2xl bg-ink-foreground/5 p-5 text-left ring-1 ring-ink-foreground/10 transition-all duration-300 hover:-translate-y-0.5 hover:bg-ink-foreground/10 hover:ring-accent/40 hover:glow-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink/60 text-accent ring-1 ring-accent/30 transition-transform duration-300 group-hover:scale-105">
          {icon}
        </span>
        <p className="title-display text-5xl leading-none tabular-nums">{value}</p>
      </div>
      <p className="label-mono mt-4 text-ink-foreground/40">{label}</p>
      <p className="mt-1.5 truncate text-xs text-ink-foreground/50">{hint}</p>
      <p className="label-mono mt-3 text-accent/70 transition-colors group-hover:text-accent">
        Voir les projets
      </p>
    </button>
  );
}

/**
 * Synthèse de la console : indicateurs globaux et avancement des livraisons.
 * La liste des projets se consulte dans l'onglet « Projets ».
 */
export function AdminDashboard({
  projects,
  videos,
  comments,
  adminId,
  onOpenProjects,
  onNew,
}: {
  projects: ProjectRow[];
  videos: OverviewVideo[];
  comments: OverviewComment[];
  adminId: string;
  onOpenProjects: () => void;
  onNew: () => void;
}) {
  const totals = useMemo(() => {
    const live = projects.filter((p) => !p.archived_at);
    const paid = live.filter((p) => p.is_paid).length;
    const rushs = videos.filter((x) => x.kind === "rushs").length;
    const week = Date.now() - 7 * 86400000;
    const clientComments = comments.filter((x) => x.author_id !== adminId);
    const withVideo = new Set(videos.map((x) => x.project_id));
    return {
      live: live.length,
      paid,
      pending: live.length - paid,
      rushs,
      finals: videos.length - rushs,
      clientComments: clientComments.length,
      thisWeek: clientComments.filter((x) => new Date(x.created_at).getTime() >= week).length,
      clients: new Set(live.map((p) => p.client_email.toLowerCase())).size,
      noVideo: live.filter((p) => !withVideo.has(p.id)).length,
    };
  }, [projects, videos, comments, adminId]);

  const progress =
    totals.live === 0 ? 0 : Math.round((totals.paid / totals.live) * 100);

  return (
    <div className="space-y-6">
      {/* prise en main : visible tant qu'il n'y a aucun projet */}
      {projects.length === 0 && (
        <div className="rounded-2xl bg-accent/10 p-6 ring-1 ring-accent/30">
          <p className="label-mono text-accent">Bienvenue — par où commencer</p>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              {
                n: "1",
                t: "Créez un projet client",
                d: "Nom du client, son email et le titre de la livraison.",
              },
              {
                n: "2",
                t: "Déposez vos montages",
                d: "Glissez vos fichiers vidéo dans la zone de dépôt du projet.",
              },
              {
                n: "3",
                t: "Envoyez le lien client",
                d: "Copiez le lien de livraison et envoyez-le à votre client.",
              },
            ].map((s) => (
              <li key={s.n} className="rounded-xl bg-ink/40 p-4 ring-1 ring-ink-foreground/10">
                <span className="grid size-7 place-items-center rounded-full bg-accent font-mono text-xs text-accent-foreground">
                  {s.n}
                </span>
                <p className="mt-3 text-sm font-medium">{s.t}</p>
                <p className="mt-1 text-xs text-pretty text-ink-foreground/50">{s.d}</p>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={onNew}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> Créer mon premier projet
          </button>
        </div>
      )}

      {/* KPIs médaillons */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          icon={<FolderKanban className="size-5" />}
          label="Projets"
          value={totals.live}
          hint={`${totals.clients} client${totals.clients > 1 ? "s" : ""} · ${totals.pending} en attente`}
          onClick={onOpenProjects}
        />
        <Stat
          icon={<Film className="size-5" />}
          label="Séquences en ligne"
          value={videos.length}
          hint={`${totals.rushs} rushs · ${totals.finals} montages`}
          onClick={onOpenProjects}
        />
        <Stat
          icon={<MessageSquare className="size-5" />}
          label="Retours clients"
          value={totals.clientComments}
          hint={
            totals.thisWeek > 0
              ? `${totals.thisWeek} cette semaine`
              : "aucun cette semaine"
          }
          onClick={onOpenProjects}
        />
        <Stat
          icon={<ShieldCheck className="size-5" />}
          label="Téléchargements débloqués"
          value={totals.paid}
          hint={`${progress}% des projets validés`}
          onClick={onOpenProjects}
        />
      </div>

      {/* avancement des livraisons : médaillon de pourcentage + jauge dorée */}
      <div className="rounded-2xl bg-ink-foreground/5 p-5 ring-1 ring-ink-foreground/10">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-ink/60 ring-1 ring-accent/30">
            <span className="title-display text-lg leading-none text-accent tabular-nums">
              {progress}%
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="label-mono text-ink-foreground/40">Avancement des livraisons</p>
              <p className="font-mono text-xs text-ink-foreground/60">
                {totals.paid} / {totals.live} validés
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-foreground/10">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        {totals.noVideo > 0 && (
          <p className="mt-3 text-xs text-ink-foreground/50">
            <button
              type="button"
              onClick={onOpenProjects}
              className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
            >
              {totals.noVideo} projet{totals.noVideo > 1 ? "s" : ""}
            </button>{" "}
            n'ont encore aucune vidéo en ligne.
          </p>
        )}
      </div>
    </div>
  );
}
