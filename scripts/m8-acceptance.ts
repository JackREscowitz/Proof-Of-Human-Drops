// M8 acceptance — MCP purchase tool + END-TO-END agent settlement.
//
// Proves PRD M8's Acceptance Test: full agent journey through MCP ONLY —
//   enter_draw → win (seeded force-draw) → purchase → REAL USDC tx on chain 4801 → 'purchased',
// plus: a NON-WINNING agent calling purchase is rejected. Reproducible after a reset.
//
// Uses a throwaway drop (created + deleted via admin) so the seeded demo state is untouched.
// The WINNER pays from its registered wallet (stored on the entry at enter_draw time). We fund
// the win to AGENT 2 (50 USDC + gas, verified) by making it the sole entrant of drop A; drop B
// proves the non-winner rejection (agent2 + a throwaway loser, draw, loser.purchase → rejected).
//
// Run: BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/m8-acceptance.ts
// (defaults to http://localhost:3000). Reads ADMIN_SECRET + DEMO_AGENT2_PK from .env.

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { buildAgentkitHeader } from "@/lib/agentkit-client";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MCP_URL = `${BASE_URL}/api/mcp`;
const SECRET = process.env.ADMIN_SECRET!;

let failures = 0;
function check(cond: boolean, label: string) {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

function pk(name: string): Hex {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return (v.startsWith("0x") ? v : `0x${v}`) as Hex;
}

const AGENT2_PK = pk("DEMO_AGENT2_PK");
// The second entrant in drop B. We use the HUMAN demo wallet (a KNOWN, resolvable wallet) so
// that whoever loses exercises the REAL 'not a winner' guard inside purchaseForEntry — not the
// "unknown wallet" guard. The loser is never charged (purchase is rejected before any transfer).
const SECOND_PK = pk("DEMO_HUMAN_PK");

async function admin(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-secret": SECRET },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
async function adminDelete(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: { "x-admin-secret": SECRET },
  });
  return res.status;
}

async function mcpClient(privateKey: Hex): Promise<Client> {
  const { header } = await buildAgentkitHeader({ privateKey, resourceUri: MCP_URL });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { "x-agentkit-payload": header } },
  });
  const c = new Client({ name: "m8-acceptance", version: "1.0.0" });
  await c.connect(transport);
  return c;
}

function toolJson(res: any): any {
  const text = (res.content ?? []).map((c: any) => c.text ?? "").join("\n");
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1) return { _raw: text };
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return { _raw: text }; }
}
async function call(c: Client, name: string, args: Record<string, unknown> = {}) {
  const res: any = await c.callTool({ name, arguments: args });
  return { isError: !!res.isError, data: toolJson(res), raw: res };
}

async function createDrop(name: string): Promise<string> {
  const r = await admin("/api/admin/drops", {
    name, status: "open", totalSlots: 1, priceUsdc: 10,
    variants: [{ name: "Silver" }, { name: "Black" }],
  });
  if (r.status !== 201) throw new Error(`create drop failed: ${JSON.stringify(r.json)}`);
  return r.json.drop.id as string;
}

async function main() {
  console.log(`MCP_URL = ${MCP_URL}\n`);
  const agent2Addr = privateKeyToAccount(AGENT2_PK).address;
  const secondAddr = privateKeyToAccount(SECOND_PK).address;
  console.log(`agent2 (winner/payer) = ${agent2Addr}`);
  console.log(`second entrant        = ${secondAddr}\n`);

  const dropA = await createDrop(`__m8_win_${Date.now()}`);
  const dropB = await createDrop(`__m8_lose_${Date.now()}`);

  try {
    // ===== Drop A: agent2 is the SOLE entrant → guaranteed winner → real purchase =====
    const a2 = await mcpClient(AGENT2_PK);
    const enterA = await call(a2, "enter_draw", { drop_id: dropA, variant: "Silver" });
    check(!enterA.isError && enterA.data.entered === true, `[A] agent2 enter_draw → entered (wallet ${enterA.data.wallet})`);
    check(
      (enterA.data.wallet ?? "").toLowerCase() === agent2Addr.toLowerCase(),
      `[A] entry stored agent2's verified wallet (settles from it)`,
    );

    // Pre-purchase before draw → must be rejected (not a winner yet / pending).
    const earlyBuy = await call(a2, "purchase", { drop_id: dropA });
    check(earlyBuy.isError, `[A] purchase before draw → rejected (entry is 'pending', not a winner)`);

    // Admin force-draw (seeded). Sole entrant ⇒ agent2 wins deterministically.
    await admin(`/api/admin/drops/${dropA}/seed`, { seed: "m8-demo-seed" });
    const drawA = await admin(`/api/admin/drops/${dropA}/draw`, {});
    check(drawA.status === 200 && drawA.json.draw.winnerIds.length === 1, `[A] force-draw → exactly 1 winner`);

    // check_status should now show 'won'.
    const statusA = await call(a2, "check_status", { drop_id: dropA });
    check(!statusA.isError && statusA.data.entry_status === "won", `[A] check_status → 'won'`);

    // ★ THE MONEY SHOT: agent2 purchases via MCP → REAL USDC tx on chain 4801.
    const buyA = await call(a2, "purchase", { drop_id: dropA });
    check(!buyA.isError && buyA.data.purchased === true, `[A] purchase → success`);
    const txHash = buyA.data.tx_hash;
    check(typeof txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(txHash), `[A] valid 32-byte tx hash: ${txHash}`);
    check(buyA.data.amount_usdc === "10.000000" || Number(buyA.data.amount_usdc) === 10, `[A] amount == 10 USDC`);
    check((buyA.data.from ?? "").toLowerCase() === agent2Addr.toLowerCase(), `[A] settled FROM agent2's wallet`);
    if (txHash) console.log(`     explorer: ${buyA.data.explorer_url}`);

    // Entry is now 'purchased'; a second purchase is rejected.
    const statusA2 = await call(a2, "check_status", { drop_id: dropA });
    check(!statusA2.isError && statusA2.data.entry_status === "purchased", `[A] entry → 'purchased'`);
    const buyAgain = await call(a2, "purchase", { drop_id: dropA });
    check(buyAgain.isError, `[A] re-purchase → rejected (already purchased)`);
    await a2.close();

    // ===== Drop B: prove a NON-WINNER is rejected =====
    // agent2 + a throwaway loser both enter; total_slots=1 ⇒ one loses. We then have the
    // ACTUAL loser attempt purchase and assert rejection. (Whoever loses is fine — the loser's
    // wallet is never charged because purchase is rejected before any transfer.)
    const a2b = await mcpClient(AGENT2_PK);
    const lb = await mcpClient(SECOND_PK);
    const eB1 = await call(a2b, "enter_draw", { drop_id: dropB });
    const eB2 = await call(lb, "enter_draw", { drop_id: dropB });
    check(!eB1.isError && !eB2.isError && eB1.data.entered && eB2.data.entered, `[B] two distinct agents entered`);

    const drawB = await admin(`/api/admin/drops/${dropB}/draw`, {});
    check(drawB.status === 200 && drawB.json.draw.winnerIds.length === 1, `[B] force-draw → 1 winner, 1 loser`);

    // Find which client is the loser by checking status, then assert its purchase is rejected.
    const sA = await call(a2b, "check_status", { drop_id: dropB });
    const sL = await call(lb, "check_status", { drop_id: dropB });
    const a2Lost = sA.data.entry_status === "lost";
    const loserClient = a2Lost ? a2b : lb;
    const loserName = a2Lost ? "agent2" : "human";
    check(
      (a2Lost ? sA.data.entry_status : sL.data.entry_status) === "lost",
      `[B] identified the loser (${loserName}) — status 'lost'`,
    );
    const loserBuy = await call(loserClient, "purchase", { drop_id: dropB });
    check(loserBuy.isError && /not a winner/i.test(JSON.stringify(loserBuy.raw)), `[B] loser purchase → rejected ('not a winner')`);
    await a2b.close();
    await lb.close();
  } finally {
    // Clean up throwaway drops (cascade deletes their entries/orders).
    const dA = await adminDelete(`/api/admin/drops/${dropA}`);
    const dB = await adminDelete(`/api/admin/drops/${dropB}`);
    check(dA === 200 && dB === 200, `cleanup: throwaway drops deleted`);
  }

  console.log(`\nM8_ACCEPTANCE: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("M8_ACCEPTANCE: ERROR", e); process.exit(1); });
