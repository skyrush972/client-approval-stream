import { Fragment, type ReactNode } from "react";
import { Clapperboard, MessageCircle, Trash2 } from "lucide-react";
import { STORAGE_PREFIX, useResolvedUrl } from "@/components/ProtectedPlayer";
import { R2_PREFIX } from "@/lib/r2.functions";

export type ProjectCardItem = {
  id: string;
  client_name: string;
  title: string;
  is_paid: boolean;
};

/**
 * Vignette de projet : la première image du montage (ou du premier fichier)
 * sert de miniature, comme une pochette de livraison.
 */
function CoverThumb({ url }: { url: string | null }) {
  const isFile = !!url && (url.startsWith(R2_PREFIX) || url.startsWith(STORAGE_PREFIX));
  const resolved = useResolvedUrl(isFile ? url : null);
  const src = resolved ?? (isFile ? null : url);

  return (
    <span className="film-frame relative block aspect-video overflow-hidden rounded-lg bg-ink ring-1 ring-ink-foreground/10 transition-all duration-300 group-hover:opacity-95 group-hover:ring-accent/40">
      {src ? (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-ink-foreground/25">
          <Clapperboard className="size-8" />
        </span>
      )}
      <span className="film-perf absolute inset-x-0 top-0 h-1.5 opacity-60" />
      <span className="film-perf absolute inset-x-0 bottom-0 h-1.5 opacity-60" />
    </span>
  );
}

/**
 * Grille de vignettes de projets pour l'onglet « Projets » de la console :
 * chaque carte affiche une capture du projet et fonctionne comme un dossier —
 * au clic, le détail du projet se déplie juste en dessous de sa carte,
 * les autres projets restent de simples vignettes.
 */
export function ProjectCardGrid({
  projects,
  covers,
  counts,
  pendingFeedback,
  selectedId,
  detail,
  onOpen,
  onDelete,
}: {
  projects: ProjectCardItem[];
  covers: Map<string, string | null>;
  counts: Map<string, number>;
  pendingFeedback: Map<string, number>;
  selectedId: string | null | undefined;
  detail?: ReactNode;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <p className="rounded-lg bg-ink-foreground/5 px-4 py-6 text-center text-sm text-ink-foreground/50 ring-1 ring-ink-foreground/10">
        Aucun projet pour l'instant. Créez-en un pour votre premier client.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => {
        const count = counts.get(p.id) ?? 0;
        const feedbackCount = pendingFeedback.get(p.id) ?? 0;
        const isOpen = selectedId === p.id;
        return (
          <Fragment key={p.id}>
            <div
              className={`group relative rounded-xl p-3 ring-1 transition-colors ${
                isOpen
                  ? "bg-ink-foreground/5 ring-accent/50"
                  : "ring-ink-foreground/10 hover:bg-ink-foreground/5"
              }`}
            >
              <button
                onClick={() => onOpen(p.id)}
                aria-pressed={isOpen}
                className="w-full rounded-lg text-left"
              >
                <CoverThumb url={covers.get(p.id) ?? null} />
                {feedbackCount > 0 && (
                  <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground shadow-sm">
                    <MessageCircle className="size-3.5" />
                    {feedbackCount === 1 ? "Nouveau retour" : `${feedbackCount} nouveaux retours`}
                  </span>
                )}
                <span className="mt-3 flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.client_name}</span>
                    <span className="block truncate text-sm text-ink-foreground/60">{p.title}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                      p.is_paid ? "bg-success/20 text-success" : "bg-accent/20 text-accent"
                    }`}
                  >
                    {p.is_paid ? "Payé / Validé" : "En attente"}
                  </span>
                </span>
                <span className="label-mono mt-2 flex items-center justify-between text-ink-foreground/40">
                  <span>
                    {count} vidéo{count > 1 ? "s" : ""}
                  </span>
                  {isOpen && <span className="text-accent">Dossier ouvert</span>}
                </span>
              </button>
              {onDelete && (
                <button
                  type="button"
                  aria-label={`Supprimer le projet de ${p.client_name}`}
                  title="Supprimer ce projet"
                  onClick={() => onDelete(p.id)}
                  className="absolute right-4 top-4 grid size-8 place-items-center rounded-md bg-ink/80 text-ink-foreground/60 opacity-0 ring-1 ring-ink-foreground/15 backdrop-blur transition-all hover:bg-destructive/90 hover:text-destructive-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            {isOpen && detail && <div className="col-span-full">{detail}</div>}
          </Fragment>
        );
      })}
    </div>
  );
}
