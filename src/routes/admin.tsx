import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { ProtectedPlayer } from "@/components/ProtectedPlayer";
import { VideoThumbGrid } from "@/components/VideoThumbGrid";
import { ProjectCardGrid } from "@/components/ProjectCardGrid";
import { Bell, Check } from "lucide-react";

import {
  AdminDashboard,
  type OverviewComment,
  type OverviewVideo,
} from "@/components/AdminDashboard";


import { getR2UploadUrl } from "@/lib/r2.functions";
import { deleteProject, deleteVideo, setProjectArchived } from "@/lib/projects.functions";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Console admin — projets clients et validation" },
      {
        name: "description",
        content:
          "Créez des projets clients, ajoutez les liens de rushs et de montage final, lisez les retours et débloquez le téléchargement.",
      },
      { property: "og:title", content: "Console admin — projets clients et validation" },
      {
        property: "og:description",
        content:
          "Créez des projets clients, ajoutez les liens vidéo, lisez les retours et débloquez le téléchargement.",
      },
    ],
  }),
  component: AdminPage,
});

type Project = {
  id: string;
  client_name: string;
  client_email: string;
  title: string;
  notes: string | null;
  is_paid: boolean;
  share_token: string;
  archived_at: string | null;
  created_at: string;
};


type Video = {
  id: string;
  project_id: string;
  title: string;
  kind: "rushs" | "final";
  stream_url: string;
  download_url: string | null;
  duration: string | null;
};

type Comment = {
  id: string;
  body: string;
  author_name: string;
  created_at: string;
  author_id: string | null;
  timecode?: number | null;
  resolved_at: string | null;
};

type Notif = {
  id: string;
  projectId: string;
  client: string;
  title: string;
  name: string;
  body: string;
  at: string;
  read: boolean;
};


function AdminPage() {
  const { session, role, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [view, setView] = useState<"dashboard" | "projets" | "nouveau">("dashboard");
  // Vue à retrouver quand on quitte la fiche de création (retour ou annulation).
  const returnView = useRef<"dashboard" | "projets">("dashboard");
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = notifs.filter((n) => !n.read).length;



  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/" });
    else if (role === "client") void navigate({ to: "/espace" });
  }, [loading, session, role, navigate]);

  const projectsQuery = useQuery({
    queryKey: ["admin-projects"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const projects = projectsQuery.data ?? [];
  const visibleProjects = useMemo(() => projects.filter((p) => !p.archived_at), [projects]);
  const selected = useMemo(
    () => visibleProjects.find((p) => p.id === selectedId) ?? null,
    [visibleProjects, selectedId],
  );


  const videosQuery = useQuery({
    queryKey: ["admin-videos", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("project_id", selected!.id)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as Video[];
    },
  });

  const previewVideo =
    (videosQuery.data ?? []).find((v) => v.id === previewId) ?? videosQuery.data?.[0] ?? null;

  const commentsQuery = useQuery({
    queryKey: ["admin-comments", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("project_id", selected!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Comment[];
    },
  });

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    enabled: role === "admin",
    queryFn: async () => {
      const [v, c] = await Promise.all([
        supabase
          .from("videos")
          .select("project_id,kind,stream_url,created_at")
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("comments")
          .select("id,project_id,author_id,author_name,body,created_at,resolved_at")
          .order("created_at", { ascending: false })
          .limit(5000),
      ]);
      if (v.error) throw v.error;
      if (c.error) throw c.error;
      return {
        videos: (v.data ?? []) as OverviewVideo[],
        comments: (c.data ?? []) as OverviewComment[],
      };
    },
  });

  const videoCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of overviewQuery.data?.videos ?? []) {
      map.set(v.project_id, (map.get(v.project_id) ?? 0) + 1);
    }
    return map;
  }, [overviewQuery.data]);

  const pendingFeedback = useMemo(() => {
    const map = new Map<string, number>();
    for (const comment of overviewQuery.data?.comments ?? []) {
      if (comment.author_id === user?.id || comment.resolved_at) continue;
      map.set(comment.project_id, (map.get(comment.project_id) ?? 0) + 1);
    }
    return map;
  }, [overviewQuery.data, user?.id]);

  // Image de couverture : le montage final s'il existe, sinon le premier fichier déposé.
  const coverByProject = useMemo(() => {
    const list = overviewQuery.data?.videos ?? [];
    const map = new Map<string, string | null>();
    for (const p of visibleProjects) {
      const mine = list.filter((v) => v.project_id === p.id);
      const finals = mine.filter((v) => v.kind === "final");
      const others = mine.filter((v) => v.kind !== "final").reverse();
      map.set(p.id, finals[0]?.stream_url ?? others[0]?.stream_url ?? null);
    }
    return map;
  }, [overviewQuery.data, visibleProjects]);


  const togglePaid = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase
        .from("projects")
        .update({ is_paid: next })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { next }) => {
      void qc.invalidateQueries({ queryKey: ["admin-projects"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success(next ? "Téléchargement débloqué pour le client" : "Téléchargement verrouillé");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveProject = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      setProjectArchived({ data: { id, archived } }),
    onSuccess: (_r, { archived }) => {
      void qc.invalidateQueries({ queryKey: ["admin-projects"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success(
        archived
          ? "Projet archivé — il n'apparaît plus chez votre client"
          : "Projet restauré — votre client y a de nouveau accès",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeProject = useMutation({
    mutationFn: async (id: string) => deleteProject({ data: { id } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["admin-projects"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
      void qc.invalidateQueries({ queryKey: ["admin-videos"] });
      void qc.invalidateQueries({ queryKey: ["admin-comments"] });
      setConfirmDelete(false);
      setSelectedId(null);
      setView("dashboard");
      toast.success(
        res.files > 0
          ? `Projet supprimé — ${res.removed}/${res.files} fichier(s) retirés du stockage`
          : "Projet supprimé",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const addVideo = useMutation({
    mutationFn: async (form: {
      title: string;
      kind: "rushs" | "final";
      stream_url: string;
      download_url: string;
      duration: string;
    }) => {
      const { error } = await supabase.from("videos").insert({
        project_id: selected!.id,
        title: form.title,
        kind: form.kind,
        stream_url: form.stream_url,
        download_url: form.download_url || null,
        duration: form.duration || null,
        position: (videosQuery.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-videos", selected?.id] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });

      toast.success("Vidéo ajoutée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeVideo = useMutation({
    mutationFn: async (id: string) => deleteVideo({ data: { id } }),
    onSuccess: (_r, id) => {
      if (previewId === id) setPreviewId(null);
      void qc.invalidateQueries({ queryKey: ["admin-videos", selected?.id] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Vidéo supprimée — vous pouvez déposer le bon montage");
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const createProject = useMutation({
    mutationFn: async (form: {
      client_name: string;
      client_email: string;
      title: string;
      notes: string;
    }) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          owner_id: user!.id,
          client_name: form.client_name,
          client_email: form.client_email.trim().toLowerCase(),
          title: form.title,
          notes: form.notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["admin-projects"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });

      setSelectedId(id);
      setView("projets");
      toast.success("Projet créé — déposez maintenant ses montages");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProject = useMutation({
    mutationFn: async (form: {
      client_name: string;
      client_email: string;
      title: string;
      notes: string;
    }) => {
      const { error } = await supabase
        .from("projects")
        .update({
          client_name: form.client_name,
          client_email: form.client_email.trim().toLowerCase(),
          title: form.title,
          notes: form.notes || null,
        })
        .eq("id", selected!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-projects"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });

      setEditing(false);
      toast.success("Projet modifié");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyComment = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("comments").insert({
        project_id: selected!.id,
        author_id: user!.id,
        author_name: "Vous",
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-comments", selected?.id] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCommentResolved = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { error } = await supabase
        .from("comments")
        .update({ resolved_at: resolved ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { resolved }) => {
      void qc.invalidateQueries({ queryKey: ["admin-comments", selected?.id] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success(resolved ? "Retour traité" : "Retour remis à traiter");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openProject = (id: string) => {
    setSelectedId(id);
    setEditing(false);
    setPreviewId(null);
    setConfirmDelete(false);
    setView("projets");
  };

  // Ouverture de la fiche de création : on masque toute la liste des projets.
  const openNewProject = () => {
    if (view !== "nouveau") returnView.current = view;
    setView("nouveau");
  };

  const closeNewProject = () => setView(returnView.current);

  // Échap ferme la fiche de création sans rien enregistrer.
  useEffect(() => {
    if (view !== "nouveau") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNewProject();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);


  const projectsRef = useRef<Project[]>(projects);
  projectsRef.current = projects;

  // Notifications en direct : dès qu'un client poste un retour, la console
  // le signale sans rechargement (RLS : l'admin reçoit tous les projets).
  useEffect(() => {
    if (role !== "admin" || !user) return;
    const me = user.id;
    const channel = supabase
      .channel("admin-comments-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments" },
        (payload) => {
          const c = payload.new as {
            id: string;
            project_id: string;
            author_id: string | null;
            author_name: string;
            body: string;
            created_at: string;
          };
          if (c.author_id === me) return;
          const project = projectsRef.current.find((p) => p.id === c.project_id);
          setNotifs((prev) =>
            prev.some((n) => n.id === c.id)
              ? prev
              : [
                  {
                    id: c.id,
                    projectId: c.project_id,
                    client: project?.client_name ?? "Client",
                    title: project?.title ?? "",
                    name: c.author_name || "Client",
                    body: c.body,
                    at: c.created_at,
                    read: false,
                  },
                  ...prev,
                ].slice(0, 20),
          );
          void qc.invalidateQueries({ queryKey: ["admin-overview"] });
          void qc.invalidateQueries({ queryKey: ["admin-comments"] });
          toast(c.author_name || "Client", {
            description: `Nouveau retour${project ? ` sur ${project.title}` : ""}`,
            action: { label: "Ouvrir", onClick: () => openProject(c.project_id) },
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user, qc]);

  const toggleNotifs = () => {
    const next = !showNotifs;
    if (next) setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setShowNotifs(next);
  };


  if (loading || role !== "admin") {

    return (
      <div className="grid min-h-screen place-items-center bg-ink">
        <p className="label-mono text-ink-foreground/40">Chargement…</p>
      </div>
    );
  }

  const detailPanel =
    view === "projets" && selected ? (
      <div ref={detailRef} className="scroll-mt-24 grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-7">
                <div className="mb-2">
                  <h2 className="title-display text-xl">
                    {selected.client_name} — {selected.title}
                  </h2>
                  <p className="label-mono mt-1 text-ink-foreground/40">
                    Client · {selected.client_email}
                  </p>
                </div>

                <ProjectSteps
                  hasVideos={(videosQuery.data ?? []).length > 0}
                  hasComments={(commentsQuery.data ?? []).length > 0}
                  isPaid={selected.is_paid}
                  archived={!!selected.archived_at}
                />

                {/* barre d'actions principale */}
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-ink-foreground/5 p-3 ring-1 ring-ink-foreground/10">
                  <button
                    onClick={() => {
                      const link = `https://client.skyrush972.fr/lien/${selected.share_token}`;
                      navigator.clipboard.writeText(link).then(
                        () => toast.success("Lien copié — envoyez-le à votre client"),
                        () => toast.error(`Copie impossible, voici le lien : ${link}`, { duration: 15000 }),
                      );
                    }}
                    className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                  >
                    Copier le lien client
                  </button>
                  <button
                    onClick={() =>
                      togglePaid.mutate({ id: selected.id, next: !selected.is_paid })
                    }
                    title={
                      selected.is_paid
                        ? "Le client peut télécharger — cliquez pour reverrouiller"
                        : "Le client ne peut pas encore télécharger — cliquez pour débloquer"
                    }
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ring-1 transition-colors ${
                      selected.is_paid
                        ? "bg-success/15 text-success ring-success/30 hover:bg-success/25"
                        : "bg-ink-foreground/5 text-ink-foreground/70 ring-ink-foreground/15 hover:bg-ink-foreground/10"
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full ${selected.is_paid ? "bg-success" : "bg-ink-foreground/30"}`}
                    />
                    {selected.is_paid ? "Téléchargement débloqué" : "Débloquer le téléchargement"}
                  </button>
                  <button
                    onClick={() => setEditing((v) => !v)}
                    className="rounded-md px-3 py-2 text-sm text-ink-foreground/60 ring-1 ring-ink-foreground/10 transition-colors hover:text-ink-foreground"
                  >
                    {editing ? "Fermer" : "Modifier"}
                  </button>
                  <button
                    onClick={() =>
                      archiveProject.mutate({
                        id: selected.id,
                        archived: !selected.archived_at,
                      })
                    }
                    className="rounded-md px-3 py-2 text-sm text-ink-foreground/60 ring-1 ring-ink-foreground/10 transition-colors hover:text-ink-foreground"
                  >
                    {selected.archived_at ? "Restaurer" : "Archiver"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-md px-3 py-2 text-sm text-destructive ring-1 ring-destructive/30 transition-colors hover:bg-destructive/10"
                  >
                    Supprimer
                  </button>
                </div>

                {editing && (
                  <EditProjectForm
                    busy={updateProject.isPending}
                    initial={selected}
                    onCancel={() => setEditing(false)}
                    onSubmit={(f) => updateProject.mutate(f)}
                  />
                )}

                {selected.archived_at && (
                  <div className="mb-4 rounded-lg bg-ink-foreground/5 p-4 ring-1 ring-ink-foreground/10">
                    <p className="text-sm text-pretty text-ink-foreground/70">
                      Ce projet est archivé : il n'apparaît plus dans l'espace de votre client et son
                      lien de livraison est inactif. Restaurez-le si besoin.
                    </p>
                  </div>
                )}

                {confirmDelete && (
                  <div className="mb-4 rounded-lg bg-destructive/10 p-4 ring-1 ring-destructive/30">
                    <p className="text-sm text-pretty">
                      Supprimer définitivement <strong>{selected.title}</strong> pour{" "}
                      {selected.client_name} ? Ses {videosQuery.data?.length ?? 0} vidéo(s) et{" "}
                      {commentsQuery.data?.length ?? 0} retour(s) seront effacés, ainsi que les
                      fichiers du stockage. Cette action est irréversible.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="label-mono rounded-md px-3 py-1.5 text-ink-foreground/60 ring-1 ring-ink-foreground/10 transition-colors hover:text-ink-foreground"
                      >
                        Annuler
                      </button>
                      <button
                        disabled={removeProject.isPending}
                        onClick={() => removeProject.mutate(selected.id)}
                        className="label-mono rounded-md bg-destructive px-3 py-1.5 text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {removeProject.isPending ? "Suppression…" : "Supprimer définitivement"}
                      </button>
                    </div>
                  </div>
                )}


                <VideoThumbGrid
                  videos={videosQuery.data ?? []}
                  activeId={previewVideo?.id}
                  onSelect={(id) => setPreviewId(id)}
                  onDelete={(id) => {
                    const v = videosQuery.data?.find((x) => x.id === id);
                    if (
                      window.confirm(
                        `Supprimer définitivement « ${v?.title ?? "cette vidéo"} » ? Le fichier et ses retours seront effacés.`,
                      )
                    )
                      removeVideo.mutate(id);
                  }}
                />

                {previewVideo && (
                  <div className="mt-6">
                    <p className="label-mono mb-3 text-ink-foreground/40">
                      Aperçu · {previewVideo.title}
                    </p>
                    <ProtectedPlayer
                      key={previewVideo.id}
                      url={previewVideo.stream_url}
                      title={previewVideo.title}
                      autoPlay
                    />
                    <MasterUpload
                      projectId={selected.id}
                      video={previewVideo}
                      onDone={() => void videosQuery.refetch()}
                    />
                  </div>
                )}

                <RushDropZone
                  projectId={selected.id}
                  startPosition={videosQuery.data?.length ?? 0}
                  onDone={() => {
                    void qc.invalidateQueries({ queryKey: ["admin-videos", selected.id] });
                    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
                  }}

                />

              </div>

              {/* feedback */}
              <div className="col-span-12 lg:col-span-5">
                <p className="label-mono mb-3 text-ink-foreground/40">Retours</p>
                <div className="space-y-3">
                  {(commentsQuery.data ?? []).map((c) => {
                    const resolved = !!c.resolved_at;
                    return (
                    <div
                      key={c.id}
                      className={`flex items-start gap-3 rounded-lg p-3 ring-1 transition-colors ${
                        resolved
                          ? "bg-success/10 ring-success/20"
                          : "bg-ink-foreground/5 ring-ink-foreground/10"
                      }`}
                    >
                      <button
                        type="button"
                        aria-label={resolved ? "Remettre ce retour à traiter" : "Marquer ce retour comme traité"}
                        aria-pressed={resolved}
                        title={resolved ? "Remettre à traiter" : "Marquer comme traité"}
                        disabled={toggleCommentResolved.isPending}
                        onClick={() => toggleCommentResolved.mutate({ id: c.id, resolved: !resolved })}
                        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded border transition-colors disabled:opacity-50 ${
                          resolved
                            ? "border-success bg-success text-success-foreground"
                            : "border-ink-foreground/25 text-transparent hover:border-accent"
                        }`}
                      >
                        <Check className="size-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                      <p className="mb-1 text-xs text-ink-foreground/60">
                        {c.author_id === user?.id ? "Vous" : c.author_name} ·{" "}
                        {new Date(c.created_at).toLocaleString("fr-FR")}
                        {c.timecode != null && (
                          <span className="ml-2 font-mono text-accent">
                            ⏱ {Math.floor(Number(c.timecode) / 60)}:{String(Math.floor(Number(c.timecode)) % 60).padStart(2, "0")}
                          </span>
                        )}
                      </p>
                      <p className={`text-sm text-pretty ${resolved ? "text-ink-foreground/50 line-through" : ""}`}>{c.body}</p>
                      </div>
                    </div>
                  )})}
                  {(commentsQuery.data ?? []).length === 0 && (
                    <p className="text-sm text-ink-foreground/50">Aucun retour pour l'instant.</p>
                  )}
                </div>
                <ReplyForm busy={replyComment.isPending} onSubmit={(b) => replyComment.mutate(b)} />
              </div>
            </div>
    ) : null;
  return (
    <div className="min-h-screen bg-ink text-ink-foreground">
      <div className="grid grid-cols-12">
        {/* left rail */}
        <aside className="col-span-12 flex flex-col justify-between border-b border-border p-6 lg:col-span-3 lg:min-h-screen lg:border-b-0 lg:border-r">
          <div>
            <BrandMark tone="dark" subtitle="Console admin" />

            {notifs.length > 0 && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={toggleNotifs}
                  className="flex w-full items-center justify-between gap-2 rounded-md bg-ink-foreground/5 px-3 py-2 ring-1 ring-ink-foreground/10 transition-colors hover:bg-ink-foreground/10"
                >
                  <span className="label-mono flex items-center gap-2 text-ink-foreground/60">
                    <Bell className="size-3.5" /> Nouveaux retours
                  </span>
                  {unread > 0 && (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent font-mono text-[10px] text-accent-foreground">
                      {unread}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div className="mt-2 space-y-2">
                    {notifs.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setNotifs((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
                          );
                          openProject(n.projectId);
                        }}
                        className="block w-full rounded-lg bg-ink-foreground/5 p-3 text-left ring-1 ring-ink-foreground/10 transition-colors hover:bg-ink-foreground/10"
                      >
                        <p className="mb-1 truncate text-xs text-ink-foreground/50">
                          <span className="text-accent">{n.name}</span> · {n.client}
                          <span className="ml-2 font-mono text-ink-foreground/35">
                            {new Date(n.at).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </p>
                        <p className="line-clamp-2 text-sm text-pretty">{n.body}</p>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setNotifs([]);
                        setShowNotifs(false);
                      }}
                      className="label-mono text-ink-foreground/40 transition-colors hover:text-ink-foreground"
                    >
                      Tout effacer
                    </button>
                  </div>
                )}
              </div>
            )}

            <nav className="mt-10 space-y-1 text-sm">
              <p className="label-mono mb-3 text-ink-foreground/30">Navigation</p>
              <button
                onClick={() => setView("dashboard")}
                className={`block w-full rounded-md px-3 py-2 text-left transition-colors ${
                  view === "dashboard"
                    ? "bg-ink-foreground/10 font-medium"
                    : "text-ink-foreground/60 hover:text-ink-foreground"
                }`}
              >
                Tableau de bord
              </button>
              <button
                onClick={() => {
                  setSelectedId(null);
                  setView("projets");
                }}
                className={`block w-full rounded-md px-3 py-2 text-left transition-colors ${
                  view === "projets"
                    ? "bg-ink-foreground/10 font-medium"
                    : "text-ink-foreground/60 hover:text-ink-foreground"
                }`}
              >
                Projets
              </button>

              <button
                onClick={openNewProject}
                className={`block w-full rounded-md px-3 py-2 text-left transition-colors ${
                  view === "nouveau"
                    ? "bg-ink-foreground/10 font-medium"
                    : "text-ink-foreground/60 hover:text-ink-foreground"
                }`}
              >
                Nouveau projet
              </button>
              <button
                onClick={() => {
                  void signOut().then(() => navigate({ to: "/" }));
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-ink-foreground/60 transition-colors hover:text-ink-foreground"
              >
                Déconnexion
              </button>
            </nav>
          </div>
          <p className="label-mono mt-10 text-ink-foreground/30">Session sécurisée</p>
        </aside>

        {/* main */}
        <div className="col-span-12 p-6 lg:col-span-9 lg:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-mono text-accent">Console</p>
              <h1 className="title-display mt-1 text-4xl">
                {view === "nouveau"
                  ? "Nouveau projet"
                  : view === "dashboard"
                    ? "Tableau de bord"
                    : selected
                      ? "Projet client"
                      : "Projets en cours"}
              </h1>
            </div>
            {view === "nouveau" ? (
              <button
                onClick={closeNewProject}
                className="rounded-md px-4 py-2 text-sm text-ink-foreground/60 ring-1 ring-ink-foreground/10 transition-colors hover:text-ink-foreground"
              >
                Retour aux projets
              </button>
            ) : (
              <button
                onClick={openNewProject}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                + Nouveau projet
              </button>
            )}
          </div>


          {/* Fiche de création : seule la fiche est affichée, pas la liste. */}
          {view === "nouveau" && (
            <div className="mx-auto max-w-2xl pt-4">
              <p className="mb-4 text-sm text-ink-foreground/50">
                Renseignez le client : vous déposerez ensuite ses montages et le lien de livraison
                sera généré automatiquement.
              </p>
              <NewProjectForm
                busy={createProject.isPending}
                onCancel={closeNewProject}
                onSubmit={(f) => createProject.mutate(f)}
              />
            </div>
          )}

          {view === "dashboard" && (
            <AdminDashboard
              projects={projects}
              videos={overviewQuery.data?.videos ?? []}
              comments={overviewQuery.data?.comments ?? []}
              adminId={user!.id}
              onOpenProjects={() => setView("projets")}
              onNew={openNewProject}
            />
          )}

          {/* Espace de travail d'un projet ouvert */}
          {view === "projets" && selected && (
            <div>
              <button
                onClick={() => setSelectedId(null)}
                className="mb-6 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-foreground/70 ring-1 ring-ink-foreground/10 transition-colors hover:text-ink-foreground"
              >
                ← Retour aux projets
              </button>
              {detailPanel}
            </div>
          )}

          {/* Grille des projets */}
          {view === "projets" && !selected && (
            <ProjectCardGrid
              projects={visibleProjects}
              covers={coverByProject}
              counts={videoCounts}
              pendingFeedback={pendingFeedback}
              selectedId={undefined}
              onOpen={(id) => {
                setSelectedId(id);
                setEditing(false);
                setPreviewId(null);
                setConfirmDelete(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onDelete={(id) => {
                setSelectedId(id);
                setEditing(false);
                setPreviewId(null);
                setConfirmDelete(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

        </div>
      </div>
    </div>
  );
}

const fieldClass =
  "w-full rounded-lg bg-ink-foreground/5 px-3 py-2 text-sm text-ink-foreground ring-1 ring-ink-foreground/10 outline-none placeholder:text-ink-foreground/40 focus:ring-2 focus:ring-accent";

/** Frise d'avancement : où en est le projet, d'un coup d'œil. */
function ProjectSteps({
  hasVideos,
  hasComments,
  isPaid,
  archived,
}: {
  hasVideos: boolean;
  hasComments: boolean;
  isPaid: boolean;
  archived: boolean;
}) {
  const steps = [
    { label: "Vidéos en ligne", done: hasVideos },
    { label: "Retours reçus", done: hasComments },
    { label: "Téléchargement débloqué", done: isPaid },
    { label: "Archivé", done: archived },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="mb-4 flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => {
        const isCurrent = i === current;
        return (
          <li key={s.label} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink-foreground/25">→</span>}
            <span
              className={`label-mono rounded-full px-2.5 py-1 ${
                s.done
                  ? "bg-success/15 text-success"
                  : isCurrent
                    ? "bg-accent/15 text-accent ring-1 ring-accent/40"
                    : "bg-ink-foreground/5 text-ink-foreground/35"
              }`}
            >
              {s.done ? "✓ " : ""}
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function NewProjectForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (f: {
    client_name: string;
    client_email: string;
    title: string;
    notes: string;
  }) => void;
}) {
  const [f, setF] = useState({ client_name: "", client_email: "", title: "", notes: "" });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(f);
      }}
      className="mb-6 rounded-xl bg-ink-foreground/5 p-5 ring-1 ring-ink-foreground/10"
    >
      <p className="label-mono mb-4 text-accent">Nouveau projet</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Nom du client"
          value={f.client_name}
          onChange={(e) => setF({ ...f, client_name: e.target.value })}
          className={fieldClass}
        />
        <input
          required
          type="email"
          placeholder="Email du client (son accès)"
          value={f.client_email}
          onChange={(e) => setF({ ...f, client_email: e.target.value })}
          className={fieldClass}
        />
        <input
          required
          placeholder="Titre du projet"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          className={fieldClass}
        />
        <input
          placeholder="Note interne (optionnel)"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          className={fieldClass}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          Créer le projet
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm text-ink-foreground/60 hover:text-ink-foreground"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function EditProjectForm({
  busy,
  initial,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  initial: Pick<Project, "client_name" | "client_email" | "title" | "notes">;
  onCancel: () => void;
  onSubmit: (f: {
    client_name: string;
    client_email: string;
    title: string;
    notes: string;
  }) => void;
}) {
  const [f, setF] = useState({
    client_name: initial.client_name,
    client_email: initial.client_email,
    title: initial.title,
    notes: initial.notes ?? "",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(f);
      }}
      className="mb-4 rounded-xl bg-ink-foreground/5 p-5 ring-1 ring-ink-foreground/10"
    >
      <p className="label-mono mb-4 text-accent">Modifier le projet</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Nom du client"
          value={f.client_name}
          onChange={(e) => setF({ ...f, client_name: e.target.value })}
          className={fieldClass}
        />
        <input
          required
          type="email"
          placeholder="Email du client (son accès)"
          value={f.client_email}
          onChange={(e) => setF({ ...f, client_email: e.target.value })}
          className={fieldClass}
        />
        <input
          required
          placeholder="Titre du projet"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          className={fieldClass}
        />
        <input
          placeholder="Note interne (optionnel)"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          className={fieldClass}
        />
      </div>
      <p className="label-mono mt-3 text-ink-foreground/40">
        L'email détermine le compte client qui accède à ce projet.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm text-ink-foreground/60 hover:text-ink-foreground"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function MasterUpload({
  projectId,
  video,
  onDone,
}: {
  projectId: string;
  video: Video;
  onDone: () => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const hasMaster = !!video.download_url && video.download_url !== video.stream_url;

  const upload = async (file: File) => {
    setProgress(0);
    try {
      const r = await getR2UploadUrl({
        data: { projectId, fileName: `master-${file.name}` },
      });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", r.uploadUrl);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () =>
          xhr.status < 300 ? resolve() : reject(new Error(`Erreur ${xhr.status}`));
        xhr.onerror = () =>
          reject(new Error("Envoi bloqué (vérifiez la règle CORS du bucket R2)"));
        xhr.send(file);
      });
      const { error } = await supabase
        .from("videos")
        .update({ download_url: r.marker })
        .eq("id", video.id);
      if (error) throw error;
      toast.success("Master haute qualité associé ✓");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="mt-4 rounded-xl bg-ink-foreground/5 p-4 ring-1 ring-ink-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-mono text-accent">Fichier Master (téléchargement)</p>
          <p className="mt-1 text-xs text-ink-foreground/50">
            {hasMaster
              ? "Master haute qualité associé ✓ — le client télécharge cette version."
              : "Version haute qualité que le client téléchargera une fois la livraison validée."}
          </p>
        </div>
        <label
          className={`label-mono cursor-pointer rounded-md px-3 py-1.5 ring-1 transition-colors ${
            progress !== null
              ? "pointer-events-none opacity-50 ring-ink-foreground/20"
              : "bg-accent/10 text-accent ring-accent/40 hover:bg-accent/20"
          }`}
        >
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={progress !== null}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          {progress !== null
            ? `Envoi… ${progress}%`
            : hasMaster
              ? "Remplacer le Master"
              : "Ajouter le Master"}
        </label>
      </div>
      {progress !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-foreground/10">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function RushDropZone({
  projectId,
  startPosition,
  onDone,
}: {
  projectId: string;
  startPosition: number;
  onDone: () => void;
}) {
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("video/"));
    if (!list.length) {
      toast.error("Déposez des fichiers vidéo (mp4, mov…)");
      return;
    }
    let pos = startPosition;
    for (const [i, file] of list.entries()) {
      setProgress(`Envoi ${i + 1}/${list.length} · ${file.name} · 0%`);
      let marker: string;
      try {
        const r = await getR2UploadUrl({ data: { projectId, fileName: file.name } });
        marker = r.marker;
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", r.uploadUrl);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable)
              setProgress(
                `Envoi ${i + 1}/${list.length} · ${file.name} · ${Math.round((ev.loaded / ev.total) * 100)}%`,
              );
          };
          xhr.onload = () =>
            xhr.status < 300 ? resolve() : reject(new Error(`Erreur ${xhr.status}`));
          xhr.onerror = () =>
            reject(new Error("Envoi bloqué (vérifiez la règle CORS du bucket R2)"));
          xhr.send(file);
        });
      } catch (err) {
        toast.error(`${file.name} : ${(err as Error).message}`);
        continue;
      }
      pos += 1;
      const { error: e2 } = await supabase.from("videos").insert({
        project_id: projectId,
        title: file.name.replace(/\.[^.]+$/, ""),
        kind: "final",
        stream_url: marker,
        download_url: marker,
        position: pos,
      });
      if (e2) toast.error(e2.message);
    }
    setProgress(null);
    toast.success("Montages déposés");
    onDone();
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!progress) void upload(e.dataTransfer.files);
      }}
      className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        over ? "border-accent bg-accent/10" : "border-ink-foreground/20 hover:border-accent/60"
      }`}
    >
      <input
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        disabled={!!progress}
        onChange={(e) => e.target.files && void upload(e.target.files)}
      />
      <p className="label-mono text-accent">Dépôt des montages</p>
      <p className="title-display mt-2 text-xl">
        {progress ?? (
          <>
            Glissez vos fichiers <span className="title-italic">ici</span>
          </>
        )}
      </p>
      <p className="mt-1 text-xs text-ink-foreground/50">
        ou cliquez pour choisir · visibles aussitôt par le client
      </p>
    </label>
  );
}

function AddVideoForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (f: {
    title: string;
    kind: "rushs" | "final";
    stream_url: string;
    download_url: string;
    duration: string;
  }) => void;
}) {
  const [f, setF] = useState({
    title: "",
    kind: "final" as "rushs" | "final",
    stream_url: "",
    download_url: "",
    duration: "",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(f);
        setF({ title: "", kind: f.kind, stream_url: "", download_url: "", duration: "" });
      }}
      className="mt-4 rounded-xl bg-ink-foreground/5 p-4 ring-1 ring-ink-foreground/10"
    >
      <p className="label-mono mb-3 text-ink-foreground/40">Ajouter un lien vidéo</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Titre (ex. Montage final v2)"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          className={fieldClass}
        />
        <select
          value={f.kind}
          onChange={(e) => setF({ ...f, kind: e.target.value as "rushs" | "final" })}
          className={fieldClass}
        >
          <option value="final">Montage final</option>
          <option value="rushs">Rushs</option>
        </select>
        <input
          required
          type="url"
          placeholder="Lien de lecture (YouTube, Vimeo, .mp4…)"
          value={f.stream_url}
          onChange={(e) => setF({ ...f, stream_url: e.target.value })}
          className={fieldClass}
        />
        <input
          type="url"
          placeholder="Lien de téléchargement (débloqué après validation)"
          value={f.download_url}
          onChange={(e) => setF({ ...f, download_url: e.target.value })}
          className={fieldClass}
        />
        <input
          placeholder="Durée (ex. 02:14)"
          value={f.duration}
          onChange={(e) => setF({ ...f, duration: e.target.value })}
          className={fieldClass}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-ink-foreground/10 px-4 py-2 text-sm font-medium text-ink-foreground disabled:opacity-50"
      >
        Ajouter
      </button>
    </form>
  );
}

function ReplyForm({ busy, onSubmit }: { busy: boolean; onSubmit: (body: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        onSubmit(body.trim());
        setBody("");
      }}
      className="mt-4 rounded-lg bg-ink-foreground/5 p-3 ring-1 ring-ink-foreground/10"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Répondre au client…"
        className="w-full resize-none bg-transparent text-sm text-ink-foreground outline-none placeholder:text-ink-foreground/40"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          Envoyer
        </button>
      </div>
    </form>
  );
}

