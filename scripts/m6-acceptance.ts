// M6 acceptance — fair draw engine + winner → purchase window.
//
// Proves, against the REAL production services (lib/draw.service.ts, lib/settlement.service.ts):
//   1. DETERMINISM: a fixed seed + a known entry set yields the EXACT same winner every run
//      (runDraw is called twice on identical inputs → identical winner ids).
//   2. CORRECT COUNT: exactly `total_slots` winners, the rest `lost`.
//   3. REAL PURCHASE: the winner settles a real 10-USDC transfer on chain 4801 (M5) and ends
//      `purchased`; the linked `orders` row is `confirmed`.
//   4. NON-WINNERS BLOCKED: a `lost` entry calling purchase is rejected (NotAWinnerError);
//      re-purchasing the won entry is rejected (AlreadyPurchasedError).
//
// Self-cleaning: creates a throwaway drop and deletes it at the end (cascades entries/orders).
import "dotenv/config";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, entries, orders } from "@/lib/db/schema";
import {
  createDrop,
  insertDummyEntry,
  setSeed,
  deleteDrop,
} from "@/lib/drops.service";
import {
  runDraw,
  purchaseForEntry,
  NotAWinnerError,
  AlreadyPurchasedError,
} from "@/lib/draw.service";
import { getWallet } from "@/lib/wallets";
import { CHAIN_ID } from "@/lib/chain";

let failures = 0;
function ok(cond: boolean, label: string) {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

// Mirror of lib/draw.service.ts rankKey for the SEEDED path — lets the test independently
// predict the winner and assert runDraw agrees (not just that it's stable across runs).
function predictWinner(seed: string, entryIds: string[]): string {
  return [...entryIds]
    .map((id) => ({ id, key: createHash("sha256").update(`${seed}:${id}`).digest("hex") }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.id < b.id ? -1 : 1))[0].id;
}

async function statusOf(entryId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ status: entries.status })
    .from(entries)
    .where(eq(entries.id, entryId))
    .limit(1);
  return row?.status;
}

async function resetToPending(entryIds: string[]) {
  for (const id of entryIds) {
    await db
      .update(entries)
      .set({ status: "pending", purchaseDeadline: null })
      .where(eq(entries.id, id));
  }
  // also clear the drop's draw stamp so the second draw is a clean run
}

async function main() {
  console.log(`M6 acceptance — fair draw + real purchase on chain ${CHAIN_ID}\n`);

  const SEED = "m6-judge-seed-001";
  const PRICE = "10"; // 10 USDC = 10_000_000 raw

  // Winner & non-winners all map to the funded "human" demo wallet so whichever entry wins
  // can actually pay; the receiver is the agent1 demo wallet.
  const human = getWallet("human");
  const receiver = getWallet("agent1");
  console.log(`signer (human)   ${human.address}`);
  console.log(`receiver (agent1) ${receiver.address}\n`);

  // --- Build a throwaway drop with 5 known entries -----------------------------------------
  const drop = await createDrop({
    name: `__m6_test_${Date.now()}`,
    status: "open",
    totalSlots: 1,
    priceUsdc: PRICE,
    drawSeed: SEED,
    variants: [{ name: "Silver" }],
  });
  await setSeed(drop.id, SEED); // explicit, even though createDrop set it

  const entryIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = await insertDummyEntry(drop.id, `m6-human-${i}`, null, human.address);
    entryIds.push(id);
  }
  ok(entryIds.length === 5, "5 candidate entries seeded");

  // Independent prediction of the seeded winner.
  const predicted = predictWinner(SEED, entryIds);
  console.log(`predicted winner (independent SHA-256): ${predicted}\n`);

  // --- 1) DETERMINISM: two draws on the identical entry set → identical winner -------------
  const draw1 = await runDraw(drop.id);
  ok(draw1.winnerIds.length === 1, "draw produced exactly total_slots (1) winner");
  ok(draw1.loserIds.length === 4, "the other 4 entries are losers");
  ok(draw1.winnerIds[0] === predicted, "draw winner == independently-predicted seeded winner");

  // Reset entries to pending and re-draw with the same seed → same winner.
  await resetToPending(entryIds);
  const draw2 = await runDraw(drop.id);
  ok(
    draw2.winnerIds[0] === draw1.winnerIds[0],
    `re-draw with same seed → SAME winner (${draw2.winnerIds[0] === draw1.winnerIds[0]})`,
  );

  const winnerId = draw2.winnerIds[0];
  const loserId = draw2.loserIds[0];
  ok((await statusOf(winnerId)) === "won", "winner entry status == 'won'");
  ok((await statusOf(loserId)) === "lost", "a non-winner entry status == 'lost'");

  // --- 4a) NON-WINNER blocked BEFORE the winner buys --------------------------------------
  let loserBlocked = false;
  try {
    await purchaseForEntry({
      entryId: loserId,
      privateKey: human.privateKey,
      receiverAddress: receiver.address,
    });
  } catch (err) {
    loserBlocked = err instanceof NotAWinnerError;
  }
  ok(loserBlocked, "a LOST entry cannot purchase (NotAWinnerError)");

  // --- 3) REAL PURCHASE by the winner ------------------------------------------------------
  console.log("\nwinner purchasing 10 USDC on-chain …");
  const purchase = await purchaseForEntry({
    entryId: winnerId,
    privateKey: human.privateKey,
    receiverAddress: receiver.address,
  });
  console.log("  txHash:", purchase.txHash);
  console.log("  explorer:", purchase.explorerUrl);
  console.log("  amount:", purchase.amountUsdc, "| orderId:", purchase.orderId, "\n");

  ok(/^0x[0-9a-fA-F]{64}$/.test(purchase.txHash), "purchase tx hash is a valid 32-byte hash");
  ok(purchase.amountUsdc === "10", "purchase amount == 10 USDC (drop price)");
  ok(purchase.status === "purchased", "purchase result status == 'purchased'");
  ok((await statusOf(winnerId)) === "purchased", "winner entry status → 'purchased'");

  // Linked, confirmed order.
  if (purchase.orderId) {
    const [row] = await db.select().from(orders).where(eq(orders.id, purchase.orderId));
    ok(!!row, "orders row exists");
    ok(row.entryId === winnerId, "orders.entry_id linked to the winning entry");
    ok(row.status === "confirmed", "orders.status == 'confirmed'");
    ok(row.amountUsdc === "10.000000", "orders.amount_usdc == 10.000000");
    ok(row.toAddress === receiver.address, "orders.to_address == receiver");
  }

  // --- 4b) re-purchasing the won entry is rejected ----------------------------------------
  let dblBlocked = false;
  try {
    await purchaseForEntry({
      entryId: winnerId,
      privateKey: human.privateKey,
      receiverAddress: receiver.address,
    });
  } catch (err) {
    dblBlocked = err instanceof AlreadyPurchasedError;
  }
  ok(dblBlocked, "re-purchasing the same winner is rejected (AlreadyPurchasedError)");

  // --- cleanup -----------------------------------------------------------------------------
  await deleteDrop(drop.id);
  const [gone] = await db.select().from(drops).where(eq(drops.id, drop.id));
  ok(!gone, "throwaway drop deleted (cascade cleaned entries/orders)");

  console.log(`\nM6_ACCEPTANCE: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
  console.log(`VERIFY: ${purchase.explorerUrl}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
