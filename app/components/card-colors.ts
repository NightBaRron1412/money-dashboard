// Preset color palette for account / credit-card cards. Each entry maps a
// slug (stored in the DB) to the Tailwind class strings used to render the
// icon tint and the utilization-bar fill.
//
// Slugs are stable; renaming one will orphan existing card colors. To add a
// new color, append a new entry — existing values keep working.
export type CardColorSlug =
  | "slate"
  | "blue"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "purple"
  | "fuchsia";

export interface CardColor {
  slug: CardColorSlug;
  /** Background + foreground for the icon tile */
  icon: string;
  /** Fill colour for progress / utilization bars */
  bar: string;
  /** Solid swatch for the color-picker UI */
  swatch: string;
}

export const CARD_COLORS: readonly CardColor[] = [
  { slug: "slate",    icon: "bg-slate-500/10 text-slate-400",     bar: "bg-slate-500",   swatch: "bg-slate-500" },
  { slug: "blue",     icon: "bg-blue-500/10 text-blue-400",       bar: "bg-blue-500",    swatch: "bg-blue-500" },
  { slug: "sky",      icon: "bg-sky-500/10 text-sky-400",         bar: "bg-sky-500",     swatch: "bg-sky-500" },
  { slug: "emerald",  icon: "bg-emerald-500/10 text-emerald-400", bar: "bg-emerald-500", swatch: "bg-emerald-500" },
  { slug: "amber",    icon: "bg-amber-500/10 text-amber-400",     bar: "bg-amber-500",   swatch: "bg-amber-500" },
  { slug: "rose",     icon: "bg-rose-500/10 text-rose-400",       bar: "bg-rose-500",    swatch: "bg-rose-500" },
  { slug: "purple",   icon: "bg-purple-500/10 text-purple-400",   bar: "bg-purple-500",  swatch: "bg-purple-500" },
  { slug: "fuchsia",  icon: "bg-fuchsia-500/10 text-fuchsia-400", bar: "bg-fuchsia-500", swatch: "bg-fuchsia-500" },
] as const;

const BY_SLUG = new Map(CARD_COLORS.map((c) => [c.slug, c]));

/**
 * Resolve a stored color slug to its class strings, falling back to a
 * caller-supplied default (e.g., the existing type-based icon style) when
 * the slug is null/unknown.
 */
export function cardColorClasses(
  slug: string | null | undefined,
  fallback: { icon: string; bar: string }
): { icon: string; bar: string } {
  if (!slug) return fallback;
  const found = BY_SLUG.get(slug as CardColorSlug);
  return found ? { icon: found.icon, bar: found.bar } : fallback;
}
