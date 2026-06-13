// Pre-demo checklist (M10) — prints a GREEN/RED board so you know the live system is demo-ready
// before standing in front of judges. Checks, against the LIVE Railway URL + chain 4801:
//   • wallet USDC + ETH balances (the winner wallets must hold ≥ price + gas)
//   • drop statuses (Mac Mini `open`, Mac Studio `coming_soon`) + Mac Mini is fresh (0 entries)
//   • the draw seed on Mac Mini (cleared = a clean slate the demo re-stages)
//   • MCP reachability — `…/api/mcp` advertises the 5 tools
//   • World ID v4 action present on each demo drop (the Sybil gate is wired)
//
// Read-only: no money moves, no state changes. Run:
//   BASE_URL=https://worldcoinapp-production.up.railway.app \
//   pnpm exec tsx scripts/predemo-check.ts
import "dotenv/config";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getBalances } from "@/lib/settlement.service";
import { getWallet } from "@/lib/wallets";
import { CHAIN_ID } from "@/lib/chain";

const BASE_URL = (
  process.env.BASE_URL || "https://worldcoinapp-production.up.railway.app"
).replace(/\/$/, "");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

// The minimums each role wallet needs for ONE demo run. The web winner pays from `human`,
// a winning agent pays from `agent2`; both need price (10 USDC) + a little gas.
const PRICE_USDC = 10;
const MIN_GAS_ETH = 0.001; // a USDC transfer costs far less; this is comfortable headroom.

let red = 0;
function row(green: boolean, label: string, detail = "") {
  console.log(`${green ? "🟢 OK  " : "🔴 RED "} ${label}${detail ? `  ${detail}` : ""}`);
  if (!green) red++;
}

const EXPECTED_TOOLS = ["list_drops", "get_drop_info", "enter_draw", "check_status", "purchase"];

async function main() {
  console.log(`PRE-DEMO CHECK · chain ${CHAIN_ID}`);
  console.log(`BASE_URL = ${BASE_URL}\n`);

  // --- Health ------------------------------------------------------------------------------
  try {
    const h = await (await fetch(`${BASE_URL}/api/health`)).json();
    row(h.ok === true, "app health (/api/health)");
    const d = await (await fetch(`${BASE_URL}/api/health/db`)).json();
    row(d.db === "ok", "database health (/api/health/db)");
  } catch (e) {
    row(false, "app/db health", String(e));
  }

  // --- Wallet balances ---------------------------------------------------------------------
  console.log("\nWALLETS (chain 4801):");
  const roles: Array<{ name: string; note: string; needUsdc: number }> = [
    { name: "human", note: "web winner pays from here", needUsdc: PRICE_USDC },
    { name: "agent2", note: "winning agent pays from here", needUsdc: PRICE_USDC },
    { name: "agent1", note: "default receiver (must pay gas only if it sends)", needUsdc: 0 },
  ];
  for (const r of roles) {
    try {
      const w = getWallet(r.name);
      const b = await getBalances(w.address);
      const okUsdc = Number(b.usdc) >= r.needUsdc;
      const okGas = Number(b.eth) >= MIN_GAS_ETH;
      row(
        okUsdc && okGas,
        `${r.name.padEnd(7)} ${w.address}`,
        `USDC ${b.usdc} / ETH ${Number(b.eth).toFixed(5)} — ${r.note}` +
          (okUsdc ? "" : ` [need ≥${r.needUsdc} USDC]`) +
          (okGas ? "" : ` [need ≥${MIN_GAS_ETH} ETH]`),
      );
    } catch (e) {
      row(false, `${r.name} balance`, String(e));
    }
  }

  // --- Drop statuses + freshness + action --------------------------------------------------
  console.log("\nDROPS:");
  let macMiniId: string | undefined;
  try {
    const drops = (await (await fetch(`${BASE_URL}/api/drops`)).json()).drops ?? [];
    const macMini = drops.find((d: any) => d.name === "Mac Mini");
    const macStudio = drops.find((d: any) => d.name === "Mac Studio");
    macMiniId = macMini?.id;

    row(macMini?.status === "open", "Mac Mini is OPEN", macMini ? `(status=${macMini.status})` : "(missing!)");
    row(!!macMini?.worldActionId, "Mac Mini has a World ID v4 action", macMini?.worldActionId ?? "");
    row(
      macStudio?.status === "coming_soon",
      "Mac Studio is COMING_SOON",
      macStudio ? `(status=${macStudio.status})` : "(missing!)",
    );
    row(!!macStudio?.worldActionId, "Mac Studio has a World ID v4 action", macStudio?.worldActionId ?? "");
    // Seed should be cleared on Mac Mini for a clean slate (the demo stages it per run).
    row(
      macMini?.drawSeed == null,
      "Mac Mini seed is clear (fresh slate)",
      macMini?.drawSeed ? `(seed=${macMini.drawSeed})` : "",
    );
  } catch (e) {
    row(false, "fetch drops", String(e));
  }

  // Mac Mini freshness (0 entries) — needs admin auth.
  if (macMiniId && ADMIN_SECRET) {
    try {
      const res = await fetch(`${BASE_URL}/api/admin/drops/${macMiniId}/entries`, {
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      const body = await res.json();
      const total = body.counts?.total ?? -1;
      row(total === 0, "Mac Mini has 0 entries (fresh)", `(entries=${total})`);
    } catch (e) {
      row(false, "Mac Mini entry count", String(e));
    }
  } else {
    console.log("⚪ SKIP Mac Mini entry-count (set ADMIN_SECRET to check freshness)");
  }

  // --- MCP reachability --------------------------------------------------------------------
  console.log("\nMCP:");
  try {
    const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}/api/mcp`));
    const client = new Client({ name: "predemo-check", version: "1.0.0" });
    await client.connect(transport);
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    const haveAll = EXPECTED_TOOLS.every((t) => tools.includes(t));
    row(haveAll, `MCP advertises the ${EXPECTED_TOOLS.length} tools`, `(${tools.join(", ")})`);
    await client.close();
  } catch (e) {
    row(false, "MCP reachability", String(e));
  }

  // --- Verdict -----------------------------------------------------------------------------
  console.log(
    `\n${red === 0 ? "✅ ALL GREEN — demo-ready" : `❌ ${red} RED item(s) — fix before demoing`}`,
  );
  process.exit(red === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("predemo-check ERROR:", e);
  process.exit(1);
});
