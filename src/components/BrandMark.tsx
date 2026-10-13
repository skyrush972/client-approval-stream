import { BRAND_NAME } from "@/lib/brand";
// Le logo est servi depuis le dossier public (indépendant de Lovable).
const logoAsset = { url: "/logo-skyrush.png" };

export function BrandMark({
  subtitle,
  tone = "light",
}: {
  subtitle?: string;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";
  return (
    <div className="flex items-center gap-3">
      <img
        src={logoAsset.url}
        alt={`Logo ${BRAND_NAME}`}
        className="size-10 object-contain"
        loading="lazy"
      />
      <div>
        <p
          className={
            isDark
              ? "title-display text-lg leading-none tracking-wide text-ink-foreground"
              : "title-display text-lg leading-none tracking-wide text-foreground"
          }
        >
          {BRAND_NAME}
        </p>
        {subtitle ? (
          <p
            className={
              isDark ? "label-mono mt-1 text-ink-foreground/40" : "label-mono mt-1 text-muted-foreground"
            }
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
