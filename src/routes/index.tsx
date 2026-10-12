import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { BRAND_NAME } from "@/lib/brand";
import heroAerial from "@/assets/hero-aerial.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Espace de livraison vidéo — accès privé" },
      {
        name: "description",
        content:
          "Accès privé aux livraisons vidéo : connectez-vous pour visionner vos rushs et montages, laisser vos retours et récupérer vos fichiers.",
      },
      { property: "og:title", content: "Espace de livraison vidéo — accès privé" },
      {
        property: "og:description",
        content:
          "Connectez-vous pour visionner vos rushs et montages, laisser vos retours et récupérer vos fichiers.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    if (role === "admin") void navigate({ to: "/admin" });
    else if (role === "client") void navigate({ to: "/espace" });
  }, [loading, session, role, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const fr = /weak|easy to guess|pwned/i.test(msg)
        ? "Ce mot de passe est trop courant ou a déjà fuité sur internet. Choisissez-en un plus unique (ex. : mélange de mots, chiffres et symboles)."
        : /invalid login credentials/i.test(msg)
          ? "Email ou mot de passe incorrect."
          : /email not confirmed/i.test(msg)
            ? "Veuillez d'abord confirmer votre email via le lien reçu."
            : /already registered/i.test(msg)
              ? "Un compte existe déjà avec cet email. Connectez-vous."
              : /at least/i.test(msg)
                ? "Le mot de passe doit contenir au moins 6 caractères."
                : msg || "Connexion impossible";
      toast.error(fr);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* left: brand panel sur image aérienne */}
      <section className="relative flex flex-col justify-between overflow-hidden p-10">
        <img
          src={heroAerial}
          alt="Survol de la Martinique par drone"
          width={1920}
          height={1088}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/50 to-ink/85" />

        <div className="relative">
          <BrandMark tone="dark" subtitle="Livraison vidéo privée" />
        </div>
        <div className="rise-in relative">
          <p className="label-mono text-accent">— Accès réservé</p>
          <h1 className="title-display mt-3 text-4xl leading-[1.1] text-ink-foreground sm:text-5xl">
            Vos rushs et montages,
            <br />
            <span className="title-italic">livrés en main propre.</span>
          </h1>
          <p className="mt-4 max-w-md text-pretty text-sm text-ink-foreground/70">
            Visionnage en streaming, retours écrits sur chaque livrable, et téléchargement
            débloqué dès la validation du paiement.
          </p>
        </div>
        <p className="label-mono relative text-ink-foreground/40">
          Session sécurisée · {BRAND_NAME}
        </p>
      </section>

      {/* right: auth form */}
      <section className="flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm">
          <p className="label-mono text-muted-foreground">
            {mode === "signin" ? "Connexion" : "Créer un accès"}
          </p>
          <h2 className="title-display mt-2 text-3xl text-foreground">
            {mode === "signin" ? (
              <>
                Entrer dans <span className="title-italic">l'espace</span>
              </>
            ) : (
              <>
                Nouvel <span className="title-italic">accès</span>
              </>
            )}
          </h2>

          {sent ? (
            <div className="mt-6 rounded-xl bg-surface p-5 ring-1 ring-border">
              <p className="text-sm text-foreground">
                Vérifiez votre boîte mail : un lien de confirmation vient d'être envoyé à{" "}
                <span className="font-medium">{email}</span>.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setMode("signin");
                }}
                className="label-mono mt-4 text-accent"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3">
              {mode === "signup" && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  className="w-full rounded-lg bg-surface px-4 py-3 text-sm text-foreground ring-1 ring-border outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                />
              )}
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresse email"
                className="w-full rounded-lg bg-surface px-4 py-3 text-sm text-foreground ring-1 ring-border outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="w-full rounded-lg bg-surface px-4 py-3 text-sm text-foreground ring-1 ring-border outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Un instant…" : mode === "signin" ? "Se connecter" : "Créer l'accès"}
              </button>
            </form>
          )}

          {!sent && (
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-5 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {mode === "signin"
                ? "Première visite ? Créer votre accès"
                : "Vous avez déjà un accès ? Se connecter"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
