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
  { slug: "slate",    icon: "bg-[#7d8490]/10 text-[#7d8490]", bar: "bg-[#7d8490]", swatch: "bg-[#7d8490]" },
  { slug: "blue",     icon: "bg-[#4f6edb]/10 text-[#4f6edb]", bar: "bg-[#4f6edb]", swatch: "bg-[#4f6edb]" },
  { slug: "sky",      icon: "bg-[#568ba1]/10 text-[#568ba1]", bar: "bg-[#568ba1]", swatch: "bg-[#568ba1]" },
  { slug: "emerald",  icon: "bg-[#4f8f7e]/10 text-[#4f8f7e]", bar: "bg-[#4f8f7e]", swatch: "bg-[#4f8f7e]" },
  { slug: "amber",    icon: "bg-[#b7654b]/10 text-[#b7654b]", bar: "bg-[#b7654b]", swatch: "bg-[#b7654b]" },
  { slug: "rose",     icon: "bg-[#ac6878]/10 text-[#ac6878]", bar: "bg-[#ac6878]", swatch: "bg-[#ac6878]" },
  { slug: "purple",   icon: "bg-[#8072b2]/10 text-[#8072b2]", bar: "bg-[#8072b2]", swatch: "bg-[#8072b2]" },
  { slug: "fuchsia",  icon: "bg-[#966c98]/10 text-[#966c98]", bar: "bg-[#966c98]", swatch: "bg-[#966c98]" },
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
