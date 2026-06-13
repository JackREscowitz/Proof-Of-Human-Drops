// Drop detail page (M4) — shows a drop, its variants, the entry count (fairness proof),
// and the World ID v4 entry flow. Server component: reads the drop directly from the DB.
// Pop-brutalist styling is M9; this is functional for the M4 acceptance gate.
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDropWithVariants } from "@/lib/drops.service";
import { countDropEntries } from "@/lib/entries.service";
import { DropEntryPanel } from "@/components/drop-entry-panel";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function DropPage({ params }: Params) {
  const { id } = await params;
  const drop = await getDropWithVariants(id);
  if (!drop) notFound();

  const entryCount = await countDropEntries(id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <Link href="/" className="text-sm font-bold uppercase underline">
        ← All drops
      </Link>

      <header className="flex flex-col gap-2">
        <span className="w-fit border-2 border-black px-2 py-1 text-xs font-bold uppercase">
          {drop.status.replace("_", " ")}
        </span>
        <h1 className="text-5xl font-black uppercase tracking-tight">{drop.name}</h1>
        <p className="text-lg">
          ${Number(drop.priceUsdc).toFixed(0)} USDC · {drop.totalSlots} slot
          {drop.totalSlots === 1 ? "" : "s"} · one entry per verified human
        </p>
      </header>

      {/* Fairness panel — the visible Sybil-guarantee proof (expanded in M9). */}
      <div className="border-2 border-black p-4">
        <div className="text-4xl font-black">{entryCount}</div>
        <div className="text-sm font-bold uppercase text-zinc-600">
          unique humans entered · duplicates blocked by World ID
        </div>
      </div>

      <DropEntryPanel
        dropId={drop.id}
        variants={drop.variants.map((v) => ({ id: v.id, name: v.name }))}
        open={drop.status === "open"}
      />
    </div>
  );
}
