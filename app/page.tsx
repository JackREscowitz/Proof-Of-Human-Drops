// Landing page (M4 functional version) — lists the live + coming-soon drops as cards
// linking to each drop's entry page. The full pop-brutalist showcase lands in M9.
import Link from "next/link";
import { listDrops } from "@/lib/drops.service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const drops = await listDrops();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 p-8">
      <header className="flex flex-col gap-3 pt-8">
        <h1 className="text-5xl font-black uppercase tracking-tight sm:text-7xl">
          Proof-of-Human Drops
        </h1>
        <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          One verified human = one raffle slot per drop. No bots, no Sybils.
        </p>
      </header>

      <section className="grid gap-6 sm:grid-cols-2">
        {drops.map((drop) => (
          <Link
            key={drop.id}
            href={`/drops/${drop.id}`}
            className="flex flex-col gap-3 border-2 border-black p-6 transition-transform hover:-translate-y-1"
          >
            <span className="w-fit border-2 border-black px-2 py-1 text-xs font-bold uppercase">
              {drop.status.replace("_", " ")}
            </span>
            <h2 className="text-3xl font-black uppercase">{drop.name}</h2>
            <p className="text-base">
              ${Number(drop.priceUsdc).toFixed(0)} USDC ·{" "}
              {drop.variants.map((v) => v.name).join(" / ")}
            </p>
            <span className="mt-2 text-sm font-bold uppercase underline">
              {drop.status === "open" ? "Enter the draw →" : "View →"}
            </span>
          </Link>
        ))}
        {drops.length === 0 && (
          <p className="text-zinc-500">No drops yet. Seed via /admin.</p>
        )}
      </section>
    </div>
  );
}
