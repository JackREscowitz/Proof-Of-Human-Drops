// M13 — launch-demo: set the REAL demo timers and walk away. This script does NOT open or draw
// anything itself — it only writes the timestamps the M11 lifecycle engine HONORS. The server's
// own clock (lib/lifecycle.ticker.ts, running inside the live Railway web service) opens entries
// when opens_at passes and runs the draw when closes_at passes, with the browser closed and no
// further intervention. Set the timers, leave, and it really fires.
//
// What it sets (configurable — rehearse short, run the real thing at 1:30 / 2h):
//   • Mac Mini       → status=open, opens_at=now, closes_at=now + 90s,        NO seed (truly random)
//   • GeForce RTX 5090 → status=coming_soon, opens_at=now + 2h,
//                        closes_at=now + 2h + 5m (entry window) — at +2h it really opens, then
//                        really draws after its window.
//
// Env overrides:
//   MAC_MINI_SECONDS   (default 90)   — Mac Mini entry window length, in seconds
//   RTX_HOURS          (default 2)    — hours until the RTX 5090 opens
//   RTX_ENTRY_SECONDS  (default 300)  — RTX 5090 entry window length, in seconds (after it opens)
//
// Flags:
//   --seed-human       OFF by default. Stages the human web entry as the guaranteed winner using
//                      the M9/M10 seeded-winner mechanism, for a run where the presenter wants a
//                      certain win. Default honors "truly random" (no seed).
//
// Run (writes directly to whatever DATABASE_URL points at — the live Railway DB for the real demo):
//   pnpm exec tsx scripts/launch-demo.ts
//   MAC_MINI_SECONDS=120 RTX_HOURS=2 pnpm exec tsx scripts/launch-demo.ts
//   pnpm exec tsx scripts/launch-demo.ts --seed-human
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops } from "@/lib/db/schema";
import { findDropByName } from "@/lib/drops.service";

const BASE_URL = (
  process.env.BASE_URL || "https://worldcoinapp-production.up.railway.app"
).replace(/\/$/, "");

const MAC_MINI_NAME = "Mac Mini";
const RTX_NAME = "GeForce RTX 5090";

const MAC_MINI_SECONDS = Number(process.env.MAC_MINI_SECONDS ?? 90);
const RTX_HOURS = Number(process.env.RTX_HOURS ?? 2);
const RTX_ENTRY_SECONDS = Number(process.env.RTX_ENTRY_SECONDS ?? 300);
const SEED_HUMAN = process.argv.includes("--seed-human");

function fmtLocal(d: Date): string {
  // Wall-clock, with both local and UTC so the presenter can read it off any clock.
  return `${d.toLocaleString()} (${d.toISOString()})`;
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

async function main() {
  const now = Date.now();

  // ── Mac Mini: open NOW, close in MAC_MINI_SECONDS, no seed (truly random) ──────────────────
  const macMini = await findDropByName(MAC_MINI_NAME);
  if (!macMini) throw new Error(`"${MAC_MINI_NAME}" not found — run the seed first`);
  const macOpensAt = new Date(now);
  const macClosesAt = new Date(now + MAC_MINI_SECONDS * 1000);

  // Optional seed: stage the lone existing human web entry as the guaranteed winner. With no
  // entries yet (the usual case — entries come in live during the demo) the seed simply makes
  // whoever sorts first under it win; the presenter's --seed-human intent is "I want a sure win",
  // which is most reliable when the human is the first/only real entrant. We set a fixed seed so
  // the draw is deterministic; default leaves it null for a true CSPRNG pick.
  const macSeed = SEED_HUMAN ? `demo-human-${now}` : null;

  await db
    .update(drops)
    .set({
      status: "open",
      opensAt: macOpensAt,
      closesAt: macClosesAt,
      drawnAt: null, // clear any prior draw so the clock can draw fresh
      drawSeed: macSeed,
    })
    .where(eq(drops.id, macMini.id));

  // ── GeForce RTX 5090: coming_soon, opens in RTX_HOURS, closes RTX_ENTRY_SECONDS after that ──
  const rtx = await findDropByName(RTX_NAME);
  let rtxOpensAt: Date | null = null;
  let rtxClosesAt: Date | null = null;
  if (rtx) {
    rtxOpensAt = new Date(now + RTX_HOURS * 3600 * 1000);
    rtxClosesAt = new Date(rtxOpensAt.getTime() + RTX_ENTRY_SECONDS * 1000);
    await db
      .update(drops)
      .set({
        status: "coming_soon", // M11 lifecycle flips it to open at opens_at, on the clock
        opensAt: rtxOpensAt,
        closesAt: rtxClosesAt,
        drawnAt: null,
        drawSeed: null, // the headline raffle is truly random
      })
      .where(eq(drops.id, rtx.id));
  }

  // ── Print the exact wall-clock schedule + live URLs ────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("  LAUNCH-DEMO — real timers set. The server's clock does the rest.");
  console.log("  (this script opened/drew NOTHING — the M11 ticker fires on its own)");
  console.log("══════════════════════════════════════════════════════════════════════\n");

  console.log(`  ${MAC_MINI_NAME}  —  OPEN NOW  ($${Number(macMini.priceUsdc)})`);
  console.log(`     opens:  ${fmtLocal(macOpensAt)}`);
  console.log(`     closes: ${fmtLocal(macClosesAt)}   (entry window ${fmtDuration(MAC_MINI_SECONDS)})`);
  console.log(`     seed:   ${macSeed ? `STAGED human win (${macSeed})` : "none — TRULY RANDOM (CSPRNG)"}`);
  console.log(`     page:   ${BASE_URL}/drops/${macMini.id}`);
  console.log("");

  if (rtx && rtxOpensAt && rtxClosesAt) {
    console.log(`  ${RTX_NAME}  —  COMING SOON  ($${Number(rtx.priceUsdc)})`);
    console.log(`     opens:  ${fmtLocal(rtxOpensAt)}   (in ${fmtDuration(RTX_HOURS * 3600)})`);
    console.log(`     closes: ${fmtLocal(rtxClosesAt)}   (entry window ${fmtDuration(RTX_ENTRY_SECONDS)})`);
    console.log(`     seed:   none — TRULY RANDOM (CSPRNG)`);
    console.log(`     page:   ${BASE_URL}/drops/${rtx.id}`);
    console.log("");
  } else {
    console.log(`  ${RTX_NAME}  —  not found in DB (skipped). Run the seed if you want it.\n`);
  }

  console.log("  ──────────────────────────────────────────────────────────────────");
  console.log(`  Landing:  ${BASE_URL}/`);
  console.log(`  Admin:    ${BASE_URL}/admin`);
  console.log(`  MCP:      ${BASE_URL}/api/mcp`);
  console.log("  ──────────────────────────────────────────────────────────────────");
  console.log("\n  Now LEAVE IT. When the Mac Mini countdown hits zero the server draws");
  console.log("  itself — winner page / SOLD OUT appear with no admin or script action.");
  console.log(`  Wait the full ${fmtDuration(RTX_HOURS * 3600)} and the RTX raffle really opens, then really draws.\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error("launch-demo: ERROR", e);
  process.exit(1);
});
