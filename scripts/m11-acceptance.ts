// M11 acceptance — the NO-INTERVENTION gate. Proves drops transition on the SERVER'S OWN
// CLOCK with zero admin/script action between setup and resolution. The ONLY actor that can
// resolve the drops during the wait is the autonomous background ticker (instrumentation.ts →
// lib/lifecycle.ticker.ts) running inside the live server process.
//
// What it proves (self-cleaning on throwaway drops, so seeded demo state survives):
//   A) AUTO-OPEN: a `coming_soon` drop with opens_at in the past auto-opens — NO admin call.
//   B) AUTO-DRAW: an `open` drop with closes_at = now+~20s and ≥2 real entries auto-closes with
//      exactly total_slots winners + the rest losers AFTER we sleep past the deadline doing
//      NOTHING — then a winner settles a REAL on-chain USDC tx on chain 4801 (verified by
//      receipt). No seed → the winner is a true CSPRNG pick.
//
// IMPORTANT — how "no intervention" is enforced in this script:
//   • We create state with direct DB writes, then SLEEP. During the sleep we make NO calls
//     that would lazily trigger transitions (no listDrops, no /entry-status, no
//     applyDueTransitions).
//   • Assertion reads use getDrop / raw selects, which DO NOT trigger transitions.
//   • Therefore any state change observed after the sleep was performed by the autonomous
//     ticker in the SERVER process. Point this at the deployed Railway app (its ticker draws)
//     or run a local standalone server (its instrumentation boots the ticker). Set the env
//     LIFECYCLE_TICK_MS low (default 5000ms) so the wait is short.
//
// Run:  pnpm exec tsx scripts/m11-acceptance.ts
//   (requires a running server whose ticker shares this DATABASE_URL — see DEMO notes)
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, entries, orders } from "@/lib/db/schema";
import {
  createDrop,
  insertDummyEntry,
  getDrop,
  deleteDrop,
} from "@/lib/drops.service";
import { purchaseForEntry } from "@/lib/draw.service";
import { getWallet } from "@/lib/wallets";
import { publicClient, CHAIN_ID } from "@/lib/chain";

let failures = 0;
function ok(cond: boolean, label: string) {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Direct entry read (does NOT trigger transitions — unlike entry-status route / listDrops).
async function entryStatus(entryId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ status: entries.status })
    .from(entries)
    .where(eq(entries.id, entryId))
    .limit(1);
  return row?.status;
}

async function main() {
  console.log(`M11 acceptance — autonomous time-driven lifecycle on chain ${CHAIN_ID}\n`);

  // How long to wait for the ticker. Must exceed the close offset + one tick interval + a
  // margin. Defaults assume a ~5s ticker. Override with M11_CLOSE_SECONDS / M11_WAIT_SECONDS.
  const CLOSE_SECONDS = Number(process.env.M11_CLOSE_SECONDS ?? 20);
  const WAIT_SECONDS = Number(process.env.M11_WAIT_SECONDS ?? CLOSE_SECONDS + 25);

  // Winner maps to the funded "human" demo wallet so whoever wins can actually pay.
  const human = getWallet("human");
  const receiver = getWallet("agent1");
  console.log(`signer (human)    ${human.address}`);
  console.log(`receiver (agent1) ${receiver.address}\n`);

  // ── A) AUTO-OPEN: coming_soon with opens_at in the past ──────────────────────────────────
  const opener = await createDrop({
    name: `__m11_open_${Date.now()}`,
    status: "coming_soon",
    totalSlots: 1,
    priceUsdc: "10",
    opensAt: new Date(Date.now() - 5_000), // already due
    variants: [{ name: "Silver" }],
  });
  console.log(`[A] created coming_soon drop ${opener.id} with opens_at 5s in the PAST`);

  // ── B) AUTO-DRAW: open with closes_at = now + CLOSE_SECONDS, ≥2 entries, NO seed ─────────
  const drawer = await createDrop({
    name: `__m11_draw_${Date.now()}`,
    status: "open",
    totalSlots: 1,
    priceUsdc: "10",
    opensAt: new Date(),
    closesAt: new Date(Date.now() + CLOSE_SECONDS * 1000),
    drawSeed: null, // true CSPRNG draw
    variants: [{ name: "Silver" }],
  });
  // Two real entries (both map to the funded human wallet so whichever wins can settle).
  const e1 = await insertDummyEntry(drawer.id, `m11-human-A-${Date.now()}`, null, human.address);
  const e2 = await insertDummyEntry(drawer.id, `m11-human-B-${Date.now()}`, null, human.address);
  console.log(`[B] created open drop ${drawer.id}, closes in ${CLOSE_SECONDS}s, 2 entries`);

  ok((await getDrop(opener.id))?.status === "coming_soon", "[A] starts coming_soon");
  ok((await getDrop(drawer.id))?.status === "open", "[B] starts open");
  ok((await entryStatus(e1)) === "pending" && (await entryStatus(e2)) === "pending",
    "[B] both entries start pending");

  // ── SLEEP — NO further action. The server's ticker is the only thing that can act. ──────
  console.log(
    `\n… sleeping ${WAIT_SECONDS}s with NO intervention (no admin call, no read that triggers transitions) …\n`,
  );
  await sleep(WAIT_SECONDS * 1000);

  // ── Assertions (direct DB reads — these never trigger a transition) ─────────────────────
  const openerAfter = await getDrop(opener.id);
  ok(openerAfter?.status === "open", "[A] coming_soon → open fired AUTONOMOUSLY (no admin call)");

  const drawerAfter = await getDrop(drawer.id);
  ok(drawerAfter?.status === "closed", "[B] open → closed fired AUTONOMOUSLY at closes_at");
  ok(!!drawerAfter?.drawnAt, "[B] drawn_at stamped by the autonomous draw");

  const s1 = await entryStatus(e1);
  const s2 = await entryStatus(e2);
  const statuses = [s1, s2];
  const winners = statuses.filter((s) => s === "won").length;
  const losers = statuses.filter((s) => s === "lost").length;
  ok(winners === 1, `[B] exactly total_slots (1) winner — got ${winners}`);
  ok(losers === 1, `[B] the other entry is a loser — got ${losers}`);

  const winnerId = s1 === "won" ? e1 : e2;

  // ── REAL on-chain settlement by the autonomously-elected winner ─────────────────────────
  console.log("\n[B] winner purchasing 10 USDC on-chain …");
  const purchase = await purchaseForEntry({
    entryId: winnerId,
    privateKey: human.privateKey,
    receiverAddress: receiver.address,
  });
  console.log("  txHash:  ", purchase.txHash);
  console.log("  explorer:", purchase.explorerUrl, "\n");

  ok(/^0x[0-9a-fA-F]{64}$/.test(purchase.txHash), "[B] real tx hash is a valid 32-byte hash");
  ok(purchase.amountUsdc === "10", "[B] amount == 10 USDC (drop price)");
  ok((await entryStatus(winnerId)) === "purchased", "[B] winner entry → 'purchased'");

  // Independently verify the receipt on chain 4801.
  const receipt = await publicClient().getTransactionReceipt({
    hash: purchase.txHash as `0x${string}`,
  });
  ok(receipt.status === "success", `[B] on-chain receipt status == success (block ${receipt.blockNumber})`);

  // Linked, confirmed order.
  if (purchase.orderId) {
    const [row] = await db.select().from(orders).where(eq(orders.id, purchase.orderId));
    ok(row?.status === "confirmed", "[B] orders row confirmed + linked");
    ok(row?.entryId === winnerId, "[B] orders.entry_id == the winning entry");
  }

  // ── cleanup ──────────────────────────────────────────────────────────────────────────────
  await deleteDrop(opener.id);
  await deleteDrop(drawer.id);
  const [g1] = await db.select().from(drops).where(eq(drops.id, opener.id));
  const [g2] = await db.select().from(drops).where(eq(drops.id, drawer.id));
  ok(!g1 && !g2, "throwaway drops deleted (cascade cleaned entries/orders)");

  console.log(`\nM11_ACCEPTANCE: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
  console.log(`VERIFY: ${purchase.explorerUrl}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
