// M9 acceptance — web purchase UI flow + cross-surface consistency.
//
// M9 adds the WEB winner→purchase path (the browser "YOU WON — PURCHASE" CTA) and proves web
// + agent entries coexist under one uniqueness rule. A real World ID proof can't be produced
// headlessly (same constraint as M4), so this drives the EXACT production code paths the UI
// uses, end to end, with REAL money on chain 4801:
//
//   1. WEB ENTRY FUNNEL: insert a web entry via the real insertWebEntry() (what /enter calls
//      post-verify), with the human demo wallet attached (M9's wallet-mapping wiring).
//   2. CROSS-SURFACE: an AGENT entry (insertAgentEntry) coexists on the same drop; both honor
//      the SAME UNIQUE(drop, human_key) gate — a duplicate web nullifier AND a duplicate agent
//      humanId are both rejected.
//   3. ADMIN VIEW: GET /api/admin/drops/:id/entries shows both sources (web + agent).
//   4. SEEDED WEB WIN: seed + force-draw (via admin HTTP) so the WEB entry wins.
//   5. WEB PURCHASE (THE M9 PATH): POST /api/drops/:id/purchase with the winning web entry —
//      the exact route the winner CTA hits — settles real USDC, entry → 'purchased'.
//   6. NON-WINNER blocked.
//
// Self-cleaning: throwaway drop, deleted at the end. Runs against BASE_URL (default: live).
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, entries, orders } from "@/lib/db/schema";
import { createDrop, setSeed, deleteDrop } from "@/lib/drops.service";
import { insertWebEntry, insertAgentEntry, AlreadyEnteredError } from "@/lib/entries.service";
import { getWallet } from "@/lib/wallets";
import { CHAIN_ID } from "@/lib/chain";

const BASE_URL =
  process.env.BASE_URL || "https://worldcoinapp-production.up.railway.app";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

let failures = 0;
function ok(cond: boolean, label: string) {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

function adminHeaders() {
  return { "content-type": "application/json", "x-admin-secret": ADMIN_SECRET };
}

async function statusOf(entryId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ status: entries.status })
    .from(entries)
    .where(eq(entries.id, entryId))
    .limit(1);
  return row?.status;
}

async function main() {
  console.log(`M9 acceptance — web purchase + cross-surface on chain ${CHAIN_ID}`);
  console.log(`BASE_URL = ${BASE_URL}\n`);
  if (!ADMIN_SECRET) {
    console.error("ADMIN_SECRET not set in env — needed for the admin HTTP ops");
    process.exit(1);
  }

  const SEED = "m9-web-winner-seed";
  const PRICE = "10";

  // The web human settles from the funded "human" demo wallet (M9 maps web → human wallet).
  const human = getWallet("human");
  const receiver = getWallet("agent1");
  console.log(`web human wallet  ${human.address}`);
  console.log(`receiver (agent1) ${receiver.address}\n`);

  // --- Throwaway drop, total_slots=1, seeded -----------------------------------------------
  const drop = await createDrop({
    name: `__m9_test_${Date.now()}`,
    status: "open",
    totalSlots: 1,
    priceUsdc: PRICE,
    drawSeed: SEED,
    variants: [{ name: "Silver" }],
  });
  await setSeed(drop.id, SEED);

  // --- 1) WEB ENTRY via the real funnel (what /enter does post-verify) ---------------------
  // A web entry is keyed by the World ID nullifier (hex). Attach the human demo wallet so the
  // winner can pay — exactly what app/api/drops/[id]/enter/route.ts now does.
  const webNullifier = "0x" + "a9".repeat(31) + "01"; // 32-byte hex, deterministic
  const webEntry = await insertWebEntry({
    dropId: drop.id,
    nullifier: webNullifier,
    walletAddress: human.address,
  });
  ok(webEntry.source === "web", "web entry recorded source='web'");
  ok(webEntry.walletAddress === human.address, "web entry stored the human demo wallet (M9 wiring)");

  // --- 2) CROSS-SURFACE: an agent entry coexists on the same drop --------------------------
  const agentHumanId = "agentkit:0xM9TestAgentWallet0000000000000000000001";
  const agentEntry = await insertAgentEntry({
    dropId: drop.id,
    humanId: agentHumanId,
    walletAddress: receiver.address,
  });
  ok(agentEntry.source === "agent", "agent entry recorded source='agent' on the SAME drop");

  // Both surfaces hit the SAME UNIQUE(drop, human_key) — duplicates blocked on each.
  let webDup = false;
  try {
    await insertWebEntry({ dropId: drop.id, nullifier: webNullifier });
  } catch (e) {
    webDup = e instanceof AlreadyEnteredError;
  }
  ok(webDup, "duplicate WEB nullifier blocked (Sybil gate, web surface)");

  let agentDup = false;
  try {
    await insertAgentEntry({ dropId: drop.id, humanId: agentHumanId });
  } catch (e) {
    agentDup = e instanceof AlreadyEnteredError;
  }
  ok(agentDup, "duplicate AGENT humanId blocked (Sybil gate, agent surface)");

  // --- 3) ADMIN cross-surface view shows BOTH sources --------------------------------------
  const entriesRes = await fetch(`${BASE_URL}/api/admin/drops/${drop.id}/entries`, {
    headers: adminHeaders(),
  });
  const entriesBody = await entriesRes.json();
  ok(entriesRes.ok, "GET /api/admin/drops/:id/entries → 200");
  ok(entriesBody.counts?.web === 1, "admin view: 1 web entry");
  ok(entriesBody.counts?.agent === 1, "admin view: 1 agent entry");
  // Auth gate on the admin entries route.
  const noAuth = await fetch(`${BASE_URL}/api/admin/drops/${drop.id}/entries`);
  ok(noAuth.status === 401, "admin entries route is auth-gated (401 without secret)");

  // --- 4) SEEDED DRAW so the WEB entry wins ------------------------------------------------
  // With total_slots=1 and 2 candidates (web + agent), seed so the WEB entry sorts first.
  // We search a few seed suffixes deterministically until the web entry is the predicted
  // winner under the production rankKey (SHA-256(seed:entryId) ascending).
  const { createHash } = await import("node:crypto");
  function rank(seed: string, id: string) {
    return createHash("sha256").update(`${seed}:${id}`).digest("hex");
  }
  let chosenSeed = SEED;
  for (let i = 0; i < 200; i++) {
    const s = `${SEED}-${i}`;
    const webKey = rank(s, webEntry.id);
    const agentKey = rank(s, agentEntry.id);
    if (webKey < agentKey) {
      chosenSeed = s;
      break;
    }
  }
  await fetch(`${BASE_URL}/api/admin/drops/${drop.id}/seed`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ seed: chosenSeed }),
  });
  const drawRes = await fetch(`${BASE_URL}/api/admin/drops/${drop.id}/draw`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ windowSeconds: 600 }),
  });
  const drawBody = await drawRes.json();
  ok(drawRes.ok, "POST /api/admin/drops/:id/draw → 200");
  ok(drawBody.draw?.winnerIds?.length === 1, "draw produced exactly 1 winner");
  ok(
    drawBody.draw?.winnerIds?.[0] === webEntry.id,
    "the WEB entry is the seeded winner (deterministic)",
  );
  ok((await statusOf(webEntry.id)) === "won", "web entry status → 'won'");
  ok((await statusOf(agentEntry.id)) === "lost", "agent entry status → 'lost'");

  // --- 5) WEB PURCHASE via the live HTTP route (the M9 winner CTA path) --------------------
  console.log("\nweb winner purchasing 10 USDC via POST /api/drops/:id/purchase …");
  const purRes = await fetch(`${BASE_URL}/api/drops/${drop.id}/purchase`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entryId: webEntry.id }),
  });
  const pur = await purRes.json();
  console.log("  →", purRes.status, JSON.stringify(pur).slice(0, 200), "\n");
  ok(purRes.status === 200, "purchase → 200");
  ok(/^0x[0-9a-fA-F]{64}$/.test(pur.txHash ?? ""), "valid 32-byte tx hash");
  ok(pur.amountUsdc === "10", "amount == 10 USDC");
  ok(pur.status === "purchased", "purchase result status == 'purchased'");
  ok((await statusOf(webEntry.id)) === "purchased", "web entry status → 'purchased'");
  console.log("  explorer:", pur.explorerUrl);

  // Linked, confirmed order from the human wallet.
  if (pur.orderId) {
    const [row] = await db.select().from(orders).where(eq(orders.id, pur.orderId));
    ok(!!row && row.entryId === webEntry.id, "orders row linked to the web entry");
    ok(!!row && row.status === "confirmed", "orders.status == 'confirmed'");
    ok(!!row && row.fromAddress === human.address, "settled FROM the human demo wallet");
  }

  // --- 6) NON-WINNER (agent) blocked from purchasing ---------------------------------------
  const loseRes = await fetch(`${BASE_URL}/api/drops/${drop.id}/purchase`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entryId: agentEntry.id }),
  });
  ok(loseRes.status === 403, "non-winner (agent) purchase → 403 not a winner");

  // --- cleanup -----------------------------------------------------------------------------
  await deleteDrop(drop.id);
  const [gone] = await db.select().from(drops).where(eq(drops.id, drop.id));
  ok(!gone, "throwaway drop deleted (cascade cleaned entries/orders)");

  console.log(`\nM9_ACCEPTANCE: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
  if (pur.explorerUrl) console.log(`VERIFY: ${pur.explorerUrl}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
