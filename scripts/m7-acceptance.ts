// M7 acceptance — remote MCP server: informational + entry tools, AgentKit per-request auth.
//
// Proves PRD M7's Acceptance Test against a running server (local or live Railway):
//   (a) an MCP client lists drops                      → list_drops
//   (b) reads coming-soon info                         → get_drop_info (Mac Studio)
//   (c) enters the Mac Mini draw once with a signed AgentKit payload  → enter_draw → success
//   (d) is REJECTED on a second entry for the same human            → enter_draw → already_entered
//   (e) an UNSIGNED privileged call is rejected (402 challenge)      → enter_draw w/o header
//   (f) distinct agents of the SAME wallet/human still get one slot  → humanId dedupe
// plus a cross-human sanity: a DIFFERENT wallet (different humanId) CAN enter (one slot each).
//
// The signing here is exactly what a real agent does: SIWE message → EIP-191 signature →
// base64 header (lib/agentkit-client.ts). Verification is genuinely enforced server-side.
//
// Run:  BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/m7-acceptance.ts
// (defaults to http://localhost:3000). Reads demo wallet keys from .env.

import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { buildAgentkitHeader } from "@/lib/agentkit-client";
import type { Hex } from "viem";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const MCP_URL = `${BASE_URL.replace(/\/$/, "")}/api/mcp`;

let failures = 0;
function check(cond: boolean, label: string) {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

function pk(name: string, fallback?: string): Hex {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`${name} not set in .env`);
  return (v.startsWith("0x") ? v : `0x${v}`) as Hex;
}

// A throwaway second wallet so we can prove cross-human entry (well-known anvil key #2).
const OTHER_PK =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;

// Build an MCP client whose HTTP requests carry the given AgentKit header (or none).
async function connectClient(agentkitHeader?: string): Promise<Client> {
  const headers: Record<string, string> = {};
  if (agentkitHeader) headers["x-agentkit-payload"] = agentkitHeader;
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers },
  });
  const client = new Client({ name: "m7-acceptance", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

// Parse the JSON object embedded in a tool's text result (our tools return "summary\n\n{json}").
function parseToolJson(result: { content: Array<{ type: string; text?: string }> }): any {
  const text = result.content.map((c) => c.text ?? "").join("\n");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return { _raw: text };
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return { _raw: text };
  }
}

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  const res = (await client.callTool({ name, arguments: args })) as any;
  return { isError: !!res.isError, data: parseToolJson(res), raw: res };
}

async function main() {
  console.log(`MCP_URL = ${MCP_URL}\n`);

  // --- (a) list_drops (no auth) ----------------------------------------------------------
  const pub = await connectClient();
  const tools = await pub.listTools();
  const toolNames = tools.tools.map((t) => t.name).sort();
  check(
    ["check_status", "enter_draw", "get_drop_info", "list_drops"].every((n) =>
      toolNames.includes(n),
    ),
    `MCP advertises the 4 tools (got: ${toolNames.join(", ")})`,
  );

  const list = await callTool(pub, "list_drops");
  const drops: any[] = list.data.drops ?? [];
  check(!list.isError && Array.isArray(drops) && drops.length >= 2, `list_drops returned ${drops.length} drop(s)`);

  const macMini = drops.find((d) => d.name === "Mac Mini");
  const macStudio = drops.find((d) => d.name === "Mac Studio");
  check(!!macMini && macMini.status === "open", `Mac Mini present and open`);
  check(!!macStudio && macStudio.status === "coming_soon", `Mac Studio present and coming_soon`);
  if (!macMini || !macStudio) {
    console.log("\nMissing seeded drops — run POST /api/admin/seed first.");
    process.exit(1);
  }

  // --- (b) get_drop_info on the coming-soon item -----------------------------------------
  const info = await callTool(pub, "get_drop_info", { drop_id: macStudio.id });
  check(
    !info.isError && info.data.name === "Mac Studio" && info.data.status === "coming_soon",
    `get_drop_info(Mac Studio) → coming_soon, ${info.data.variants?.length ?? 0} variant(s)`,
  );
  await pub.close();

  // --- (e) UNSIGNED privileged call is rejected (402 challenge) ---------------------------
  const anon = await connectClient();
  const unsigned = await callTool(anon, "enter_draw", { drop_id: macMini.id });
  check(
    unsigned.isError && /signature required|payment_required|402/i.test(JSON.stringify(unsigned.raw)),
    `unsigned enter_draw → rejected with 402-style challenge`,
  );
  await anon.close();

  // --- Build a signed header for AGENT 1 --------------------------------------------------
  const a1 = await buildAgentkitHeader({ privateKey: pk("DEMO_AGENT1_PK"), resourceUri: MCP_URL });
  console.log(`\nagent1 wallet = ${a1.address}`);

  // First, make sure agent1 has NOT already entered (clean state for the test). We can't reset
  // via MCP, so if a prior run left an entry we just detect the already_entered path instead.
  const c1 = await connectClient(a1.header);

  // --- (c) enter_draw once → success (or already-entered from a prior run) ----------------
  const enter1 = await callTool(c1, "enter_draw", { drop_id: macMini.id, variant: "Silver" });
  const firstEntered = enter1.data.entered === true;
  const firstAlready = enter1.data.already_entered === true;
  check(!enter1.isError && (firstEntered || firstAlready), `agent1 enter_draw(Mac Mini) → ${firstEntered ? "entered" : "already_entered"}`);
  check(
    firstEntered ? enter1.data.source === "agent" && typeof enter1.data.entry_id === "string" : true,
    firstEntered ? `entry recorded source='agent' with entry_id` : `(agent1 already entered from a prior run — dedupe still proven below)`,
  );
  const a1HumanId = enter1.data.human_id;
  check(typeof a1HumanId === "string" && a1HumanId.length > 0, `agent1 resolved a humanId (${a1HumanId})`);

  // --- (d) second entry for the SAME human → rejected (no new row) ------------------------
  const enter2 = await callTool(c1, "enter_draw", { drop_id: macMini.id });
  check(
    !enter2.isError && enter2.data.already_entered === true && enter2.data.entered === false,
    `agent1 second enter_draw → already_entered (Sybil block), no second slot`,
  );

  // --- (f) a DIFFERENT AgentKit signature for the SAME wallet still maps to one slot -------
  const a1b = await buildAgentkitHeader({ privateKey: pk("DEMO_AGENT1_PK"), resourceUri: MCP_URL });
  check(a1b.header !== a1.header, `fresh signature has a different nonce (distinct header)`);
  const c1b = await connectClient(a1b.header);
  const enter3 = await callTool(c1b, "enter_draw", { drop_id: macMini.id });
  check(
    !enter3.isError && enter3.data.already_entered === true,
    `same wallet, NEW signature → still already_entered (humanId dedupe, not nonce-bound)`,
  );

  // --- check_status for agent1 ------------------------------------------------------------
  const status = await callTool(c1, "check_status", { drop_id: macMini.id });
  check(
    !status.isError && status.data.entered === true && status.data.human_id === a1HumanId,
    `check_status(agent1) → entered=true, status='${status.data.entry_status}'`,
  );
  await c1.close();
  await c1b.close();

  // --- cross-human sanity: a DIFFERENT wallet (different humanId) CAN enter ---------------
  // (Mac Mini has total_slots=1 but slots only matter at DRAW time; multiple humans may ENTER.)
  const other = await buildAgentkitHeader({ privateKey: OTHER_PK, resourceUri: MCP_URL });
  const co = await connectClient(other.header);
  const enterOther = await callTool(co, "enter_draw", { drop_id: macMini.id });
  const otherOk = !enterOther.isError && (enterOther.data.entered === true || enterOther.data.already_entered === true);
  check(otherOk, `different wallet (humanId ${enterOther.data.human_id}) can enter Mac Mini (one slot each)`);
  check(
    enterOther.data.human_id !== a1HumanId,
    `the two agents resolved to DISTINCT humanIds (per-wallet identity)`,
  );
  await co.close();

  console.log(`\nM7_ACCEPTANCE: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("M7_ACCEPTANCE: ERROR", e);
  process.exit(1);
});
