// Hero panel (M11) — first full-screen snap section. Editorial brand heading + spinning 3D
// product stage + compact fairness strip + scroll cue into the first drop. Server component;
// the 3D stage and cue are client islands.
import Link from "next/link";
import HeroModelStageClient from "@/components/hero-model-stage.client";
import ScrollCue from "@/components/scroll-cue";
import ScrollToButton from "@/components/scroll-to-button";

export default function HeroPanel({
  totalEntries,
  openCount,
  scrollToSlug,
}: {
  totalEntries: number;
  openCount: number;
  scrollToSlug?: string;
}) {
  return (
    <div className="relative flex min-h-[100svh] flex-col px-5 pb-8 pt-6 sm:px-8">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b-[3px] border-ink pb-4">
        <span className="display text-xl sm:text-2xl">PROOF·OF·HUMAN</span>
        <nav className="flex items-center gap-3 text-xs font-extrabold uppercase">
          <span className="pill bg-lime">Chain 4801</span>
          <Link href="/admin" className="pill brutal-hover">
            Admin
          </Link>
        </nav>
      </header>

      {/* Hero body — editorial heading (left) + spinning 3D stage (right). */}
      <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 py-10 lg:grid-cols-[1.2fr_1fr] lg:gap-24">
        <div className="flex flex-col gap-9 sm:gap-10">
          <span className="pill bg-lime">Spring 2026 · Limited Drop</span>
          <h1 className="display text-[15vw] leading-[1.04] sm:text-7xl lg:text-8xl">
            BOT-PROOF
            <br />
            DROPS FOR
            <br />
            <span className="mt-1 inline-block bg-lime px-2 leading-[1.08] box-decoration-clone">
              REAL HUMANS
            </span>
          </h1>
          <p className="max-w-md text-lg font-medium">
            Scarce goods, allocated <strong>1 slot per verified human per drop</strong> —
            enforced on-chain by World ID. No bots. No Sybils. No resellers.
          </p>

          {/* Compact fairness strip — the at-a-glance Sybil-guarantee proof. */}
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y-[3px] border-ink py-4 text-sm font-bold uppercase">
            <div className="flex items-baseline gap-1.5">
              <dt className="display text-2xl">{totalEntries}</dt>
              <dd className="text-xs">humans</dd>
            </div>
            <span aria-hidden className="text-muted-foreground">·</span>
            <div className="flex items-baseline gap-1.5">
              <dt className="display text-2xl">1</dt>
              <dd className="text-xs">slot / human</dd>
            </div>
            <span aria-hidden className="text-muted-foreground">·</span>
            <div className="flex items-baseline gap-1.5">
              <dt className="display text-2xl">{openCount}</dt>
              <dd className="text-xs">live drop{openCount === 1 ? "" : "s"}</dd>
            </div>
            <span aria-hidden className="text-muted-foreground">·</span>
            <div className="flex items-baseline gap-1.5">
              <dt className="display text-2xl">∞</dt>
              <dd className="text-xs">dupes blocked</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-4">
            <ScrollToButton
              targetSlug={scrollToSlug}
              className="brutal-lime brutal-hover inline-flex items-center gap-2 px-7 py-4 text-lg font-extrabold uppercase"
            >
              Shop the drop <span aria-hidden>↓</span>
            </ScrollToButton>
          </div>
        </div>

        {/* Spinning 3D product stage — Mac Mini ⇄ RTX 5090. */}
        <div className="relative h-[42vh] min-h-[300px] w-full lg:h-[68vh] lg:pl-6">
          <HeroModelStageClient />
        </div>
      </div>

      {/* Scroll cue — nudge down into the first drop panel. */}
      <ScrollCue targetSlug={scrollToSlug} />
    </div>
  );
}
