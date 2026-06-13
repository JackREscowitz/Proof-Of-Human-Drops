// M10 acceptance — the FULL judge demo, run TWICE back-to-back on the LIVE Railway URL with a
// clean `reset-demo` between, no manual DB surgery. This is the project's final gate.
//
// The 5 acts (PRD M10 / RESEARCH_REPORT §5), all on the SEEDED Mac Mini drop (not throwaways):
//   ACT 1 — WEB DOUBLE-ENTRY BLOCK: a verified web human enters; a replay of the same World ID
//           is blocked by UNIQUE(drop_id, human_key). (The verify step itself needs a real World
//           App proof — un-headless-able, same M4/M9 caveat — so we drive the EXACT production
//           funnel insertWebEntry(), which is what /enter calls post-verify.)
//   ACT 2 — AGENT ENTERS VIA MCP: a human-backed agent calls enter_draw over the live MCP
//           endpoint with a real AgentKit per-request signature; a second call is Sybil-blocked.
//   ACT 3 — SEEDED DRAW: admin stages a seed so the intended winner (the web human) wins, then
//           force-draws over the live admin HTTP route → 1 winner, the agent loses.
//   ACT 4 — REAL USDC SETTLEMENT: the web winner purchases via the live POST /:id/purchase route
//           → a REAL on-chain USDC tx on chain 4801 with an explorer link; the loser is blocked.
//   ACT 5 — COMING-SOON VIA MCP: the agent queries get_drop_info(Mac Studio) → coming_soon info.
//
// Then RESET (the live `reset-demo` action) returns the system to Act-1 state and we run it all
// again. Each run produces one real settlement tx; both hashes are printed at the end.
//
// Run: BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/m10-acceptance.ts
import "dotenv/config";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { db } from "@/lib/db";
import { entries } from "@/lib/db/schema";
import { insertWebEntry, AlreadyEnteredError, findEntryByHumanKey } from "@/lib/entries.service";
import { getWallet } from "@/lib/wallets";
import { buildAgentkitHeader } from "@/lib/agentkit-client";
import { CHAIN_ID } from "@/lib/chain";
import type { Hex } from "viem";

const BASE_URL = (
  process.env.BASE_URL || "https://worldcoinapp-production.up.railway.app"
).replace(/\/$/, "");
const MCP_URL = `${BASE_URL}/api/mcp`;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

let failures = 0;
function ok(cond: boolean, label: string) {
  console.log(`  ${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

function adminHeaders() {
  return { "content-type": "application/json", "x-admin-secret": ADMIN_SECRET };
}
async function adminPost(path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// --- MCP client helpers (a human-backed agent signs each privileged call) -------------------
async function mcpClient(privateKey?: Hex): Promise<Client> {
  const headers: Record<string, string> = {};
  if (privateKey) {
    const { header } = await buildAgentkitHeader({ privateKey, resourceUri: MCP_URL });
    headers["x-agentkit-payload"] = header;
  }
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers },
  });
  const c = new Client({ name: "m10-acceptance", version: "1.0.0" });
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
async function callTool(c: Client, name: string, args: Record<string, unknown> = {}) {
  const res: any = await c.callTool({ name, arguments: args });
  return { isError: !!res.isError, data: toolJson(res), raw: res };
}

async function statusOf(entryId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ status: entries.status })
    .from(entries)
    .where(eq(entries.id, entryId))
    .limit(1);
  return row?.status;
}

function rank(seed: string, id: string): string {
  return createHash("sha256").update(`${seed}:${id}`).digest("hex");
}

interface DemoDrops {
  macMiniId: string;
  macStudioId: string;
}

async function fetchDrops(): Promise<DemoDrops> {
  const drops = (await (await fetch(`${BASE_URL}/api/drops`)).json()).drops ?? [];
  const macMini = drops.find((d: any) => d.name === "Mac Mini");
  const macStudio = drops.find((d: any) => d.name === "Mac Studio");
  if (!macMini || !macStudio) throw new Error("demo drops missing — run seed first");
  return { macMiniId: macMini.id, macStudioId: macStudio.id };
}

// One full 5-act run on the seeded Mac Mini drop. Returns the real settlement tx hash.
async function runDemo(runNo: number, drops: DemoDrops): Promise<string> {
  console.log(`\n========== DEMO RUN ${runNo} ==========`);
  const { macMiniId, macStudioId } = drops;

  // The web human settles from the funded "human" demo wallet; the agent uses agent2 (it will
  // lose the seeded draw, so it's never charged — its 10 USDC is untouched). Receiver = agent1.
  const human = getWallet("human");
  const AGENT_PK = (process.env.DEMO_AGENT2_PK!.startsWith("0x")
    ? process.env.DEMO_AGENT2_PK!
    : `0x${process.env.DEMO_AGENT2_PK!}`) as Hex;

  // --- ACT 1 — WEB DOUBLE-ENTRY BLOCK ------------------------------------------------------
  console.log("ACT 1 — web double-entry block");
  // A fresh, deterministic nullifier per run so each run is a distinct "human" (post-reset the
  // prior rows are gone, but a unique value keeps runs independent even if reset were skipped).
  const webNullifier = "0x" + createHash("sha256").update(`m10-web-${runNo}`).digest("hex");
  const webEntry = await insertWebEntry({
    dropId: macMiniId,
    nullifier: webNullifier,
    walletAddress: human.address,
  });
  ok(webEntry.source === "web", "web human entered Mac Mini (source='web')");
  ok(webEntry.walletAddress === human.address, "web entry mapped to the human demo wallet");
  let webDup = false;
  try {
    await insertWebEntry({ dropId: macMiniId, nullifier: webNullifier });
  } catch (e) {
    webDup = e instanceof AlreadyEnteredError;
  }
  ok(webDup, "SAME World ID re-entry blocked (Sybil gate, web surface) — no 2nd slot");

  // --- ACT 2 — AGENT ENTERS VIA MCP --------------------------------------------------------
  console.log("ACT 2 — agent enters via MCP (AgentKit per-request signature)");
  const agent = await mcpClient(AGENT_PK);
  const enterA = await callTool(agent, "enter_draw", { drop_id: macMiniId, variant: "Black" });
  ok(!enterA.isError && enterA.data.entered === true, "agent enter_draw → entered (signed call)");
  const agentHumanId: string = enterA.data.human_id ?? enterA.data.humanId ?? "";
  // Unsigned privileged call must be rejected (402-style challenge).
  const anon = await mcpClient();
  const unsigned = await callTool(anon, "enter_draw", { drop_id: macMiniId });
  ok(unsigned.isError, "UNSIGNED enter_draw → rejected (AgentKit auth enforced)");
  await anon.close();
  // Second signed call by the same agent → Sybil-blocked (already entered).
  const enterA2 = await callTool(agent, "enter_draw", { drop_id: macMiniId });
  ok(
    enterA2.isError || enterA2.data.already_entered === true || enterA2.data.entered === false,
    "SAME agent re-entry blocked (Sybil gate, agent surface)",
  );

  // Resolve the agent's entry id (for loser assertions below).
  const agentEntry = agentHumanId
    ? await findEntryByHumanKey(macMiniId, agentHumanId)
    : undefined;
  ok(!!agentEntry, "agent entry recorded (source='agent') alongside the web entry");

  // --- ACT 3 — SEEDED DRAW (stage the web human to win) ------------------------------------
  console.log("ACT 3 — seeded fair draw (web human staged to win)");
  // total_slots=1, two candidates (web + agent). Find a seed under which the web entry sorts
  // first (rankKey = SHA-256(seed:entryId) ascending). This is exactly how the production draw
  // ranks, so the live draw will pick the same winner.
  const BASE_SEED = `m10-demo-${runNo}`;
  let chosenSeed = BASE_SEED;
  if (agentEntry) {
    for (let i = 0; i < 500; i++) {
      const s = `${BASE_SEED}-${i}`;
      if (rank(s, webEntry.id) < rank(s, agentEntry.id)) {
        chosenSeed = s;
        break;
      }
    }
  }
  await adminPost(`/api/admin/drops/${macMiniId}/seed`, { seed: chosenSeed });
  const draw = await adminPost(`/api/admin/drops/${macMiniId}/draw`, { windowSeconds: 600 });
  ok(draw.status === 200, "admin force-draw → 200");
  ok(draw.json.draw?.winnerIds?.length === 1, "draw produced exactly 1 winner");
  ok(draw.json.draw?.winnerIds?.[0] === webEntry.id, "the WEB human is the seeded winner (deterministic)");
  ok((await statusOf(webEntry.id)) === "won", "web entry → 'won'");
  if (agentEntry) ok((await statusOf(agentEntry.id)) === "lost", "agent entry → 'lost'");

  // --- ACT 4 — REAL USDC SETTLEMENT --------------------------------------------------------
  console.log("ACT 4 — real USDC settlement on chain 4801");
  const purRes = await fetch(`${BASE_URL}/api/drops/${macMiniId}/purchase`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entryId: webEntry.id }),
  });
  const pur = await purRes.json();
  ok(purRes.status === 200, "winner purchase → 200");
  const txHash: string = pur.txHash ?? "";
  ok(/^0x[0-9a-fA-F]{64}$/.test(txHash), `valid on-chain tx hash: ${txHash}`);
  ok(pur.amountUsdc === "10", "amount == 10 USDC");
  ok(pur.status === "purchased", "purchase result status == 'purchased'");
  ok((await statusOf(webEntry.id)) === "purchased", "web entry → 'purchased'");
  console.log(`     explorer: ${pur.explorerUrl}`);
  // The loser (agent) cannot purchase.
  if (agentEntry) {
    const lose = await fetch(`${BASE_URL}/api/drops/${macMiniId}/purchase`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId: agentEntry.id }),
    });
    ok(lose.status === 403, "non-winner (agent) purchase → 403 not a winner");
  }

  // --- ACT 5 — COMING-SOON VIA MCP ---------------------------------------------------------
  console.log("ACT 5 — coming-soon query via MCP");
  const info = await callTool(agent, "get_drop_info", { drop_id: macStudioId });
  ok(!info.isError, "get_drop_info(Mac Studio) → ok");
  ok(info.data.status === "coming_soon", "Mac Studio reported coming_soon via MCP");
  ok(
    Array.isArray(info.data.variants) && info.data.variants.length === 2,
    "Mac Studio info includes its 2 variants",
  );
  await agent.close();

  console.log(`RUN ${runNo} settlement tx: ${txHash}`);
  return txHash;
}

// The reset choreography that lets the demo run again with no manual DB surgery.
async function resetDemo(drops: DemoDrops) {
  console.log("\n---------- RESET (live `reset-demo`) ----------");
  const r = await adminPost(`/api/admin/drops/${drops.macMiniId}/reset-demo`);
  ok(r.status === 200 && r.json.ok === true, "reset-demo → 200 ok");
  // Confirm the system is back at Act-1 state.
  const after = await fetchDrops();
  const live = (await (await fetch(`${BASE_URL}/api/drops`)).json()).drops.find(
    (d: any) => d.id === after.macMiniId,
  );
  const cs = (await (await fetch(`${BASE_URL}/api/drops`)).json()).drops.find(
    (d: any) => d.id === after.macStudioId,
  );
  ok(live?.status === "open", "after reset: Mac Mini is OPEN again");
  ok(live?.drawSeed == null, "after reset: Mac Mini seed cleared");
  ok(cs?.status === "coming_soon", "after reset: Mac Studio is COMING_SOON");
  // Fresh: 0 entries.
  const ent = await fetch(`${BASE_URL}/api/admin/drops/${after.macMiniId}/entries`, {
    headers: { "x-admin-secret": ADMIN_SECRET },
  });
  const entBody = await ent.json();
  ok(entBody.counts?.total === 0, "after reset: Mac Mini has 0 entries (clean slate)");
}

async function main() {
  console.log(`M10 acceptance — full demo ×2 on chain ${CHAIN_ID}`);
  console.log(`BASE_URL = ${BASE_URL}`);
  if (!ADMIN_SECRET) {
    console.error("ADMIN_SECRET not set — needed for the admin HTTP ops");
    process.exit(1);
  }
  if (!process.env.DEMO_AGENT2_PK) {
    console.error("DEMO_AGENT2_PK not set — needed for the agent path");
    process.exit(1);
  }

  // Start from a known-clean state (idempotent — resets the seeded drops only).
  const drops = await fetchDrops();
  await resetDemo(drops);

  const tx1 = await runDemo(1, drops);
  await resetDemo(drops);
  const tx2 = await runDemo(2, drops);

  // Leave the system clean for the live demo / next iteration.
  await resetDemo(drops);

  console.log(`\n==================================================`);
  console.log(`M10_ACCEPTANCE: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
  console.log(`Run 1 settlement tx: https://sepolia.worldscan.org/tx/${tx1}`);
  console.log(`Run 2 settlement tx: https://sepolia.worldscan.org/tx/${tx2}`);
  console.log(`Two clean back-to-back live runs, reset between, no manual DB surgery.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("M10_ACCEPTANCE: ERROR", e);
  process.exit(1);
});
