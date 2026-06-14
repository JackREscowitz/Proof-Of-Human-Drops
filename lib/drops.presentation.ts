// Presentation metadata for the drop panels (M11). This is *display* data — slugs, product
// photos, accent colors, spec copy — that doesn't belong in the DB. Keyed by drop name so it
// maps onto whatever the seed created. The scroll deck + item panels read from here.

export type DropPresentation = {
  slug: string; // deep-link URL segment, e.g. "mac-mini" → /mac-mini
  accent: string; // tailwind bg-* class for the panel accent
  tagline: string; // short line above the title
  // Product photos. If `byVariant` is set, the panel swaps the photo to match the selected
  // finish (keyed by variant NAME); `default` is the fallback / single photo.
  photo: {
    default: string;
    byVariant?: Record<string, string>;
  };
  specs: string[]; // bullet list (store3-style)
};

// name (exact DB drop name) → presentation
const BY_NAME: Record<string, DropPresentation> = {
  "Mac Mini": {
    slug: "mac-mini",
    accent: "bg-lime",
    tagline: "Apple M4 · Desktop",
    photo: {
      default: "/products/mac-mini-black.webp",
      byVariant: {
        Silver: "/products/mac-mini-silver.webp",
        Black: "/products/mac-mini-black.webp",
      },
    },
    specs: [
      "Apple M4 chip · 10-core CPU",
      "16GB unified memory",
      "256GB SSD storage",
      "Two finishes — Silver / Black",
      "One verified human wins · ships worldwide",
    ],
  },
  "GeForce RTX 5090": {
    slug: "rtx-5090",
    accent: "bg-pop-blue",
    tagline: "NVIDIA Blackwell · Founders Edition",
    photo: {
      default: "/products/rtx-5090.webp",
    },
    specs: [
      "NVIDIA Blackwell architecture",
      "32GB GDDR7 · 512-bit bus",
      "21,760 CUDA cores",
      "Founders Edition dual-flow-through cooler",
      "One verified human wins · ships worldwide",
    ],
  },
};

// Slugs in display order (drives the scroll deck order after the hero).
export const DROP_SLUG_ORDER = ["mac-mini", "rtx-5090"] as const;

export function presentationFor(dropName: string): DropPresentation | undefined {
  return BY_NAME[dropName];
}

export function slugForDrop(dropName: string): string | undefined {
  return BY_NAME[dropName]?.slug;
}

// All recognized panel slugs, including the hero, in scroll order.
export const HERO_SLUG = "";
export function allPanelSlugs(): string[] {
  return [HERO_SLUG, ...DROP_SLUG_ORDER];
}
