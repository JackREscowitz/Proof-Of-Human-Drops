// Server component that assembles the full scroll deck (M11): a hero panel followed by one
// full-screen ItemPanel per live drop, ordered by DROP_SLUG_ORDER. Reads the DB directly and
// hands the panels to the client ScrollDeck (which does snap + URL sync + deep-link scroll).
//
// Both routes (/ and /[slug]) render this; they differ only in `initialSlug`.
import { listDrops } from "@/lib/drops.service";
import { countDropEntries } from "@/lib/entries.service";
import {
  presentationFor,
  DROP_SLUG_ORDER,
} from "@/lib/drops.presentation";
import ScrollDeck, { type DeckPanel } from "@/components/scroll-deck";
import HeroPanel from "@/components/hero-panel";
import ItemPanel from "@/components/item-panel";

export default async function DropDeck({ initialSlug }: { initialSlug: string }) {
  const drops = await listDrops();

  // Fairness numbers for the hero stat strip.
  const counts = await Promise.all(drops.map((d) => countDropEntries(d.id)));
  const totalEntries = counts.reduce((a, b) => a + b, 0);
  const openCount = drops.filter((d) => d.status === "open").length;

  // Order the drops by the presentation slug order; drop anything without presentation meta.
  const ordered = DROP_SLUG_ORDER.map((slug) =>
    drops.find((d) => presentationFor(d.name)?.slug === slug),
  ).filter((d): d is NonNullable<typeof d> => Boolean(d));

  const firstItemSlug = ordered[0]
    ? presentationFor(ordered[0].name)!.slug
    : undefined;

  const panels: DeckPanel[] = [
    {
      slug: "",
      node: (
        <HeroPanel
          totalEntries={totalEntries}
          openCount={openCount}
          scrollToSlug={firstItemSlug}
        />
      ),
    },
    ...ordered.map((drop, i) => {
      const presentation = presentationFor(drop.name)!;
      return {
        slug: presentation.slug,
        node: (
          <ItemPanel
            dropId={drop.id}
            name={drop.name}
            priceUsdc={drop.priceUsdc}
            status={drop.status}
            variants={drop.variants.map((v) => ({ id: v.id, name: v.name }))}
            presentation={presentation}
            index={i + 1}
            total={ordered.length}
          />
        ),
      } satisfies DeckPanel;
    }),
  ];

  return <ScrollDeck panels={panels} initialSlug={initialSlug} />;
}
