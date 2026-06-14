// M13 — practice-agents: an OPTIONAL solo-rehearsal harness for the AGENT side of the demo.
//
// ‼️ THIS IS NOT USED IN THE LIVE DEMO. In the real demo the presenter asks their OWN agents
//    (Claude / ChatGPT with the MCP connector added) to enter, by hand. This script lets ONE
//    presenter rehearse the agent arc alone, with no second person and no phone — it has the two
//    demo agent wallets call the LIVE MCP exactly as a real connected agent would.
//
// What it does (entirely over the live MCP — the same streamable-HTTP endpoint a real agent uses,
// with REAL AgentKit per-request signatures; the script itself never opens or draws a drop):
//   1. Both agent1 + agent2 call  enter_draw(Mac Mini)  with their own signed payloads.
//      (Distinct human-backed agents → two slots; the per-human Sybil rule still holds per human.)
//   2. WAIT for the drop's real closes_at — the M11 ticker in the live server draws on its own clock.
//      The script does nothing during the wait but poll list_drops to show the countdown.
//   3. Both agents call  check_status(Mac Mini)  → prints genuine WON / LOST.
//   4. The winning agent calls the  purchase  MCP tool → a REAL USDC settlement from its own
//      registered wallet on chain 4801; prints the tx hash + explorer link.
//
// PRE-REQ: the Mac Mini drop must be OPEN with a real closes_at — run `scripts/launch-demo.ts`
//          first (use a short MAC_MINI_SECONDS to rehearse fast, e.g. MAC_MINI_SECONDS=60).
//          The agents must be funded (agent1/agent2 ≥ drop price + gas) so the winner can pay.
//
// Run:  BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/practice-agents.ts
//       (defaults to the live URL; override BASE_URL for a local standalone server.)
import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getWallet } from "@/lib/wallets";
import { buildAgentkitHeader } from "@/lib/agentkit-client";
import { CHAIN_ID } from "@/lib/chain";
import type { Hex } from "viem";

const BASE_URL = (
  process.env.BASE_URL || "https://worldcoinapp-production.up.railway.app"
).replace(/\/$/, "");
const MCP_URL = `${BASE_URL}/api/mcp`;
const DROP_NAME = "Mac Mini";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- MCP client (a human-backed agent signs each privileged call with its wallet) ------------
async function mcpClient(privateKey: Hex, label: string): Promise<Client> {
  const { header } = await buildAgentkitHeader({ privateKey, resourceUri: MCP_URL });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { "x-agentkit-payload": header } },
  });
  const c = new Client({ name: `practice-${label}`, version: "1.0.0" });
  await c.connect(transport);
  return c;
}
function toolJson(res: any): any {
  const text = (res.content ?? []).map((c: any) => c.text ?? "").join("\n");
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s === -1 || e === -1) return { _raw: text };
  try {
    return JSON.parse(text.slice(s, e + 1));
  } catch {
    return { _raw: text };
  }
}
async function call(c: Client, name: string, args: Record<string, unknown> = {}) {
  const res: any = await c.callTool({ name, arguments: args });
  return { isError: !!res.isError, data: toolJson(res) };
}

interface LiveDrop {
  id: string;
  name: string;
  status: string;
  closesAt: string | null;
  priceUsdc: string;
}
async function fetchMacMini(): Promise<LiveDrop> {
  const body = await (await fetch(`${BASE_URL}/api/drops`)).json();
  const d = (body.drops ?? []).find((x: any) => x.name === DROP_NAME);
  if (!d) throw new Error(`"${DROP_NAME}" not found — seed first`);
  return d;
}

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════════════");
  console.log("  PRACTICE-AGENTS — solo rehearsal of the AGENT side  (NOT the live demo)");
  console.log(`  live MCP: ${MCP_URL}   ·   chain ${CHAIN_ID}`);
  console.log("══════════════════════════════════════════════════════════════════════\n");

  // Pre-flight: the drop must be open with a real countdown.
  let drop = await fetchMacMini();
  if (drop.status !== "open") {
    console.error(
      `  ✗ ${DROP_NAME} is "${drop.status}", not open. Run scripts/launch-demo.ts first ` +
        `(e.g. MAC_MINI_SECONDS=60 pnpm exec tsx scripts/launch-demo.ts), then re-run this.`,
    );
    process.exit(1);
  }
  if (!drop.closesAt) {
    console.error(
      `  ✗ ${DROP_NAME} has no closes_at — there is no countdown to wait on. Run launch-demo first.`,
    );
    process.exit(1);
  }
  const closesAt = new Date(drop.closesAt).getTime();
  console.log(`  ${DROP_NAME} is OPEN, closes at ${new Date(closesAt).toLocaleString()} ` +
    `(in ${Math.max(0, Math.round((closesAt - Date.now()) / 1000))}s)\n`);

  // Two agents back two distinct humans → two slots in the draw.
  const agents = [
    { name: "agent1", wallet: getWallet("agent1") },
    { name: "agent2", wallet: getWallet("agent2") },
  ];

  // ── 1) Both agents enter via the live MCP ──────────────────────────────────────────────────
  console.log("  [1] agents entering the draw via the live MCP (real AgentKit signatures) …");
  const clients: Record<string, Client> = {};
  for (const a of agents) {
    const c = await mcpClient(a.wallet.privateKey, a.name);
    clients[a.name] = c;
    const r = await call(c, "enter_draw", { drop_id: drop.id, variant: "Silver" });
    if (r.data.entered) {
      console.log(`      ${a.name} → ENTERED (entry ${r.data.entry_id})`);
    } else if (r.data.already_entered) {
      console.log(`      ${a.name} → already entered (Sybil rule — one slot per human)`);
    } else {
      console.log(`      ${a.name} → ${r.isError ? "REJECTED" : "no-op"}: ${JSON.stringify(r.data)}`);
    }
  }

  // ── 2) Wait for the real closes_at — the LIVE TICKER draws on its own clock ─────────────────
  console.log("\n  [2] waiting for the real closes_at — the server's ticker draws itself …");
  while (Date.now() < closesAt + 1000) {
    const remaining = Math.max(0, Math.round((closesAt - Date.now()) / 1000));
    process.stdout.write(`\r      entries close in ${remaining}s …   `);
    await sleep(2000);
  }
  process.stdout.write("\r      entries closed. waiting for the autonomous draw …      \n");
  // Give the ticker (≤5s interval) a couple of cycles to run the draw. We poll list_drops
  // (read-only) so the deployed server resolves the draw — we never call the admin draw route.
  let drawn = false;
  for (let i = 0; i < 12 && !drawn; i++) {
    await sleep(3000);
    const d = await fetchMacMini();
    if (d.status === "closed" || d.status === "settled") drawn = true;
  }
  console.log(`      drop is now "${(await fetchMacMini()).status}".\n`);

  // ── 3) Both agents check status → genuine WON / LOST ───────────────────────────────────────
  console.log("  [3] agents checking status via the live MCP …");
  let winner: { name: string; client: Client } | null = null;
  for (const a of agents) {
    const c = clients[a.name];
    const r = await call(c, "check_status", { drop_id: drop.id });
    const st = r.data.entry_status ?? "(none)";
    console.log(`      ${a.name} → ${String(st).toUpperCase()}`);
    if (st === "won") winner = { name: a.name, client: c };
  }

  // ── 4) The winning agent purchases — REAL USDC settlement from its own wallet ───────────────
  if (winner) {
    console.log(`\n  [4] ${winner.name} WON — purchasing via the MCP purchase tool (real USDC) …`);
    const r = await call(winner.client, "purchase", { drop_id: drop.id });
    if (r.data.purchased) {
      console.log(`      ✓ PURCHASED — ${r.data.amount_usdc} USDC on chain ${CHAIN_ID}`);
      console.log(`      tx:       ${r.data.tx_hash}`);
      console.log(`      explorer: ${r.data.explorer_url}`);
    } else {
      console.log(`      ✗ purchase did not complete: ${JSON.stringify(r.data)}`);
    }
  } else {
    console.log("\n  [4] no agent won this round (the draw is truly random unless --seed-human was set).");
    console.log("      Re-run launch-demo + this harness to rehearse again, or seed a guaranteed win.");
  }

  for (const a of agents) await clients[a.name].close().catch(() => {});

  console.log("\n  ──────────────────────────────────────────────────────────────────");
  console.log("  Practice run complete. THIS IS A REHEARSAL TOOL — in the live demo the");
  console.log("  presenter asks their real agents (Claude/ChatGPT) to do exactly this by hand.");
  console.log("  ──────────────────────────────────────────────────────────────────\n");
  process.exit(0);
}

main().catch((e) => {
  console.error("\npractice-agents: ERROR", e);
  process.exit(1);
});
