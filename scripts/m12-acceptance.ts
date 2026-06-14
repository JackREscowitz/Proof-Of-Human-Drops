// M12 acceptance — Timer UI + SOLD OUT + dedicated winner page.
//
// Proves, against a running BASE_URL (local standalone or the LIVE Railway URL):
//   [A] /win/[entryId] renders each REAL state from the entry status (never faked):
//        won → "YOU WON" + purchase CTA · lost → NOT SELECTED · pending → YOU'RE IN ·
//        bad uuid → 404.
//   [B] the winner page's purchase path settles a REAL USDC tx on chain 4801 (same
//        POST /api/drops/:id/purchase the page calls), entry → purchased, page now shows
//        "PURCHASED" + the explorer tx; on-chain receipt == success.
//   [C] SOLD OUT is driven by the M11 engine: a drop with closes_at in the near future and
//        ≥1 entry auto-draws on the server clock (no admin call), after which it reports
//        drawn/closed (what the item panel renders as SOLD OUT).
//
// Self-cleaning: all work is on THROWAWAY drops (deleted at the end), so the seeded demo
// state (Mac Mini / RTX 5090) is untouched. The winner entry is mapped to the human demo
// wallet so its real purchase settles from a funded wallet.
//
// Usage: BASE_URL=https://… pnpm exec tsx scripts/m12-acceptance.ts
import "dotenv/config";
import { createDrop, deleteDrop, getDrop } from "@/lib/drops.service";
import { getDropWithVariants } from "@/lib/drops.service";
import { db } from "@/lib/db";
import { entries } from "@/lib/db/schema";
import { publicClient } from "@/lib/chain";

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:3210").replace(/\/$/, "");

let failures = 0;
function ok(cond: boolean, label: string) {
  console.log(`${cond ? "OK  " : "FAIL"}   ${label}`);
  if (!cond) failures++;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function makeWonEntry(name: string, status: "won" | "lost" | "pending") {
  const drop = await createDrop({
    name,
    status: "closed",
    totalSlots: 1,
    priceUsdc: "10",
    variants: [{ name: "Black", sku: "TMP-BLK", stock: 1 }],
  });
  const withVars = await getDropWithVariants(drop.id);
  const variantId = withVars?.variants[0]?.id ?? null;
  const [entry] = await db
    .insert(entries)
    .values({
      dropId: drop.id,
      humanKey: `__m12_${status}_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
      source: "web",
      status,
      variantId,
      walletAddress: process.env.DEMO_HUMAN_ADDRESS ?? null,
      purchaseDeadline: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning();
  return { dropId: drop.id, entryId: entry.id };
}

async function winPage(entryId: string) {
  const res = await fetch(`${BASE_URL}/win/${entryId}`, { cache: "no-store" } as RequestInit);
  return { status: res.status, html: res.status === 200 ? await res.text() : "" };
}

async function main() {
  console.log("M12 acceptance — winner page + SOLD OUT + real settlement");
  console.log("BASE_URL =", BASE_URL);
  const created: string[] = [];

  // ---- [A] winner-page states ----
  const bad = await fetch(`${BASE_URL}/win/not-a-uuid`);
  ok(bad.status === 404, "[A] /win/<bad-uuid> → 404 (no 500 crash)");

  const lost = await makeWonEntry("Mac Mini", "lost");
  created.push(lost.dropId);
  const lostPage = await winPage(lost.entryId);
  ok(lostPage.status === 200 && /NOT SELECTED/.test(lostPage.html), "[A] lost entry → NOT SELECTED");

  const pend = await makeWonEntry("Mac Mini", "pending");
  created.push(pend.dropId);
  const pendPage = await winPage(pend.entryId);
  ok(pendPage.status === 200 && /YOU&#x27;RE IN|YOU.RE IN/.test(pendPage.html), "[A] pending entry → YOU'RE IN");

  const win = await makeWonEntry("Mac Mini", "won");
  created.push(win.dropId);
  const wonPage = await winPage(win.entryId);
  ok(wonPage.status === 200 && /YOU WON/.test(wonPage.html), "[A] won entry → YOU WON");
  ok(/Mac Mini/.test(wonPage.html) && /mac-mini/.test(wonPage.html), "[A] won page shows product + photo");

  // ---- [B] real purchase via the winner-page route ----
  const purRes = await fetch(`${BASE_URL}/api/drops/${win.dropId}/purchase`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entryId: win.entryId }),
  });
  const pur = (await purRes.json().catch(() => ({}))) as {
    ok?: boolean; txHash?: string; explorerUrl?: string; status?: string;
  };
  ok(purRes.ok && pur.ok === true, "[B] purchase route → 200 ok");
  ok(typeof pur.txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(pur.txHash || ""), "[B] real 32-byte tx hash");
  ok(pur.status === "purchased", "[B] entry → purchased");
  if (pur.txHash) {
    const receipt = await publicClient().getTransactionReceipt({ hash: pur.txHash as `0x${string}` });
    ok(receipt.status === "success", `[B] on-chain receipt success (block ${receipt.blockNumber})`);
    console.log(`     tx: ${pur.explorerUrl}`);
  }
  const afterPage = await winPage(win.entryId);
  ok(/PURCHASED/.test(afterPage.html) && (pur.txHash ? afterPage.html.includes(pur.txHash) : false),
    "[B] winner page now shows PURCHASED + tx");

  // ---- [C] SOLD OUT driven by the M11 engine (autonomous draw on the clock) ----
  const CLOSE = Number(process.env.M12_CLOSE_SECONDS || 12);
  const soldDrop = await createDrop({
    name: "Mac Mini",
    status: "open",
    totalSlots: 1,
    priceUsdc: "10",
    closesAt: new Date(Date.now() + CLOSE * 1000),
    variants: [{ name: "Black", sku: "TMP-BLK", stock: 1 }],
  });
  created.push(soldDrop.id);
  await db.insert(entries).values({
    dropId: soldDrop.id,
    humanKey: `__m12_sold_${Date.now()}`,
    source: "web",
    status: "pending",
    walletAddress: process.env.DEMO_HUMAN_ADDRESS ?? null,
  });
  // Wait past closes_at, doing NO admin call — only a plain listDrops read (the lazy trigger)
  // or the server ticker should draw it. We trigger a read via GET /api/drops.
  console.log(`     waiting ${CLOSE + 8}s for the engine to auto-draw the sold-out drop…`);
  await sleep((CLOSE + 8) * 1000);
  await fetch(`${BASE_URL}/api/drops`, { cache: "no-store" } as RequestInit); // lazy trigger
  await sleep(1500);
  const drawn = await getDrop(soldDrop.id);
  ok(drawn?.status === "closed" || drawn?.status === "settled", `[C] auto-drew on the clock → ${drawn?.status} (SOLD OUT)`);
  ok(Boolean(drawn?.drawnAt), "[C] drawn_at stamped by the autonomous draw (no admin call)");

  // ---- cleanup ----
  for (const id of created) await deleteDrop(id).catch(() => {});
  console.log(`\ncleaned ${created.length} throwaway drops`);
  console.log(`\nM12_ACCEPTANCE: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
