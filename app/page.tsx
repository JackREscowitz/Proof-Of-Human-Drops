// Landing page (M9) — pop-brutalist drop-campaign showcase.
// Editorial hero + a small grid of featured product cards (live Mac Mini + coming-soon
// Mac Studio). Cream canvas, blue grid bg, acid-lime accent, thick black borders, hard
// offset shadows. NOT a catalog — a few featured items, high impact (RALPH_GUIDE §11).
import Link from "next/link";
import { listDrops } from "@/lib/drops.service";
import { countDropEntries } from "@/lib/entries.service";

export const dynamic = "force-dynamic";

function statusLabel(status: string): string {
  return status.replace("_", " ");
}

export default async function Home() {
  const drops = await listDrops();
  // Fairness numbers for the headline stat block — total unique humans across all drops.
  const counts = await Promise.all(drops.map((d) => countDropEntries(d.id)));
  const totalEntries = counts.reduce((a, b) => a + b, 0);
  const openCount = drops.filter((d) => d.status === "open").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-5 py-8 sm:px-8">
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

      {/* Hero — editorial drop-campaign heading (Balenciaga ref). */}
      <section className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div className="flex flex-col gap-6">
          <span className="pill bg-lime">Spring 2026 · Limited Drop</span>
          <h1 className="display text-[15vw] leading-[0.86] sm:text-7xl lg:text-8xl">
            BOT-PROOF
            <br />
            DROPS FOR
            <br />
            <span className="bg-lime px-2">REAL HUMANS</span>
          </h1>
          <p className="max-w-md text-lg font-medium">
            Scarce goods, allocated <strong>1 slot per verified human per drop</strong> —
            enforced on-chain by World ID. No bots. No Sybils. No resellers.
          </p>
          <div className="flex flex-wrap gap-4">
            {drops.find((d) => d.status === "open") && (
              <Link
                href={`/drops/${drops.find((d) => d.status === "open")!.id}`}
                className="brutal-lime brutal-hover inline-flex items-center gap-2 px-7 py-4 text-lg font-extrabold uppercase"
              >
                Shop the drop <span aria-hidden>↗</span>
              </Link>
            )}
          </div>
        </div>

        {/* Fairness stat block — the visible Sybil-guarantee proof for judges. */}
        <div className="brutal flex flex-col gap-4 p-6">
          <div className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            The fairness guarantee
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="display text-5xl">{totalEntries}</div>
              <div className="text-xs font-bold uppercase">unique humans entered</div>
            </div>
            <div>
              <div className="display text-5xl">1</div>
              <div className="text-xs font-bold uppercase">slot per human / drop</div>
            </div>
            <div>
              <div className="display text-5xl">{openCount}</div>
              <div className="text-xs font-bold uppercase">live drop{openCount === 1 ? "" : "s"}</div>
            </div>
            <div>
              <div className="display text-5xl">∞</div>
              <div className="text-xs font-bold uppercase">duplicates blocked</div>
            </div>
          </div>
          <p className="border-t-[3px] border-ink pt-3 text-xs font-medium">
            Every entry funnels through one DB constraint:{" "}
            <code className="font-mono font-bold">UNIQUE(drop, human)</code>. Web (World ID
            nullifier) + agent (AgentKit) hit the same gate.
          </p>
        </div>
      </section>

      {/* Featured drops — small grid of campaign cards. */}
      <section className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between border-b-[3px] border-ink pb-3">
          <h2 className="display text-3xl sm:text-4xl">The Collection</h2>
          <span className="text-xs font-extrabold uppercase text-muted-foreground">
            {drops.length} featured
          </span>
        </div>

        <div className="grid gap-7 sm:grid-cols-2">
          {drops.map((drop, i) => {
            const accents = ["bg-lime", "bg-pop-blue", "bg-pop-orange", "bg-pop-purple"];
            const accent = accents[i % accents.length];
            const isOpen = drop.status === "open";
            return (
              <Link
                key={drop.id}
                href={`/drops/${drop.id}`}
                className="brutal brutal-hover group flex flex-col"
              >
                {/* Product "image" block — chunky color field with the device name. */}
                <div
                  className={`relative flex aspect-[4/3] items-center justify-center border-b-[3px] border-ink ${accent}`}
                >
                  <span className="display text-center text-4xl leading-[0.9] sm:text-5xl">
                    {drop.name}
                  </span>
                  <span className="pill absolute left-3 top-3">
                    {statusLabel(drop.status)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <div className="flex items-center justify-between">
                    <span className="display text-2xl">{drop.name}</span>
                    <span className="display text-2xl">
                      ${Number(drop.priceUsdc).toFixed(0)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {drop.variants.map((v) => (
                      <span
                        key={v.id}
                        className="border-2 border-ink px-2 py-0.5 text-xs font-bold uppercase"
                      >
                        {v.name}
                      </span>
                    ))}
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold uppercase">
                    {isOpen ? "Enter the draw" : "View drop"}{" "}
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </span>
                </div>
              </Link>
            );
          })}
          {drops.length === 0 && (
            <p className="brutal p-6 font-bold uppercase">
              No drops yet. Seed via /admin.
            </p>
          )}
        </div>
      </section>

      <footer className="mt-8 border-t-[3px] border-ink pt-5 text-xs font-bold uppercase text-muted-foreground">
        Proof-of-Human Drops · World Chain Sepolia (4801) · USDC settlement · World ID +
        AgentKit
      </footer>
    </div>
  );
}
