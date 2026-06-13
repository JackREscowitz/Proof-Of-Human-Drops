// Remote MCP server (M7) — streamable-HTTP transport mounted as a Next route handler.
//
// Why a route handler: everything else in this app is here, so co-locating the MCP server
// keeps one backend + one deploy. We use the SDK's Web-Standard transport
// (WebStandardStreamableHTTPServerTransport) which speaks Web `Request`/`Response` — exactly
// what a Next App-Router route handler provides/returns, no Node req/res adapter needed.
//
// Statelessness: we run the transport in STATELESS mode (no sessionIdGenerator). Each POST
// builds a fresh McpServer + transport, connects, handles the one request, and tears down.
// That fits a route-handler/serverless model and, crucially, makes auth purely PER-REQUEST:
// every privileged tool call re-verifies the AgentKit signature from the live request headers
// (PRD M7 Option A — native per-request signature, no server session as source of truth).
//
// Tools:
//   list_drops()                  — open + coming-soon drops (public; informational)
//   get_drop_info(drop_id)        — one drop's details + this human's status if signed (public)
//   enter_draw(drop_id, variant)  — PRIVILEGED: AgentKit-verified humanId → one entry per drop
//   check_status(drop_id)         — PRIVILEGED: this human's entry status for the drop
//
// ⚠️ Next 16 carryovers: @/lib/db is a lazy proxy (connects on first use); build must pass
// `env -u DATABASE_URL pnpm build` (no env at module load — all DB access is inside handlers).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import {
  listDrops,
  getDropWithVariants,
  type DropWithVariants,
} from "@/lib/drops.service";
import {
  insertAgentEntry,
  findEntryByHumanKey,
  countDropEntries,
  AlreadyEnteredError,
} from "@/lib/entries.service";
import {
  authenticateAgent,
  AgentkitAuthError,
  AGENTKIT_HEADER,
  type AgentIdentity,
} from "@/lib/agentkit-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // agentkit-core uses viem/siwe + node crypto; not edge-safe.

// ---- Tool result helpers ----------------------------------------------------------------
// MCP tools return content blocks. We return both a human-readable text block AND a structured
// JSON block (as text) so an LLM client can read either. `isError: true` surfaces tool errors.
function ok(data: unknown, summary?: string) {
  const text = summary ? `${summary}\n\n${json(data)}` : json(data);
  return { content: [{ type: "text" as const, text }] };
}
function fail(message: string, extra?: unknown) {
  const text = extra ? `${message}\n\n${json(extra)}` : message;
  return { content: [{ type: "text" as const, text }], isError: true };
}
function json(v: unknown): string {
  return JSON.stringify(v, null, 2);
}

// Shape a drop for agent consumption (no internal seed/receiver leakage).
function publicDrop(d: DropWithVariants) {
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    price_usdc: d.priceUsdc,
    total_slots: d.totalSlots,
    opens_at: d.opensAt,
    closes_at: d.closesAt,
    drawn_at: d.drawnAt,
    variants: d.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku })),
  };
}

// Resolve the agent identity for a privileged tool call from the live request headers, or
// throw an AgentkitAuthError (the tool maps it to a 402-style challenge result).
async function requireAgent(req: Request): Promise<AgentIdentity> {
  return authenticateAgent(req);
}

// Build a fresh MCP server with all tools bound to THIS request (so privileged tools can read
// the AgentKit signature header off the live request).
function buildServer(req: Request): McpServer {
  const server = new McpServer(
    { name: "proof-of-human-drops", version: "1.0.0" },
    {
      instructions:
        "Proof-of-Human Drops: a scarce-goods drop platform where each verified human gets " +
        "exactly one raffle slot per drop. Use list_drops / get_drop_info to browse (no auth). " +
        "enter_draw and check_status are privileged: send an AgentKit per-request signature in " +
        `the '${AGENTKIT_HEADER}' header. One slot per human per drop is enforced server-side.`,
    },
  );

  // --- list_drops (public) ---------------------------------------------------------------
  server.registerTool(
    "list_drops",
    {
      title: "List drops",
      description:
        "List all drops (open + coming-soon) with their variants, price (USDC), slot count, " +
        "and timing. No authentication required — informational.",
      inputSchema: {},
    },
    async () => {
      const drops = await listDrops();
      return ok(
        { drops: drops.map(publicDrop) },
        `${drops.length} drop(s).`,
      );
    },
  );

  // --- get_drop_info (public; coming-soon informational tool) -----------------------------
  server.registerTool(
    "get_drop_info",
    {
      title: "Get drop info",
      description:
        "Get full details for one drop by id: status, variants, price, when it opens/closes, " +
        "and how many unique humans have entered. Works for coming-soon drops too. If an " +
        `AgentKit signature ('${AGENTKIT_HEADER}') is present, also returns YOUR entry status.`,
      inputSchema: { drop_id: z.string().describe("The drop id (uuid) to inspect.") },
    },
    async ({ drop_id }) => {
      const drop = await getDropWithVariants(drop_id);
      if (!drop) return fail(`drop ${drop_id} not found`);
      const entered = await countDropEntries(drop_id);

      // Best-effort: if the caller signed, include their own status — but never require it here.
      let yourEntry: { status: string; source: string } | null = null;
      try {
        const id = await requireAgent(req);
        const mine = await findEntryByHumanKey(drop_id, id.humanId);
        if (mine) yourEntry = { status: mine.status, source: mine.source };
      } catch {
        // unsigned / invalid — fine, this tool is informational.
      }

      return ok(
        {
          ...publicDrop(drop),
          unique_humans_entered: entered,
          your_entry: yourEntry,
        },
        `${drop.name} — ${drop.status} — ${entered} unique human(s) entered.`,
      );
    },
  );

  // --- enter_draw (PRIVILEGED) ------------------------------------------------------------
  server.registerTool(
    "enter_draw",
    {
      title: "Enter the draw",
      description:
        "Enter the raffle for a drop on behalf of your human. Requires an AgentKit per-request " +
        `signature in the '${AGENTKIT_HEADER}' header. Enforces ONE slot per verified human per ` +
        "drop — a second entry for the same human is rejected. Optionally pick a variant.",
      inputSchema: {
        drop_id: z.string().describe("The drop id (uuid) to enter."),
        variant: z
          .string()
          .optional()
          .describe("Variant name (e.g. 'Silver' / 'Black') or variant id. Optional."),
      },
    },
    async ({ drop_id, variant }) => {
      // 1) AgentKit per-request auth → verified wallet + humanId.
      let identity: AgentIdentity;
      try {
        identity = await requireAgent(req);
      } catch (err) {
        if (err instanceof AgentkitAuthError) {
          return fail(
            `402 — AgentKit signature required. ${err.message}`,
            {
              error: "payment_required",
              code: err.code,
              hint: `Send a base64 AgentKit payload in the '${AGENTKIT_HEADER}' header (SIWE-signed by your wallet).`,
            },
          );
        }
        throw err;
      }

      // 2) The drop must exist and be open for entry.
      const drop = await getDropWithVariants(drop_id);
      if (!drop) return fail(`drop ${drop_id} not found`);
      if (drop.status !== "open") {
        return fail(`drop "${drop.name}" is ${drop.status}, not open for entries`);
      }

      // 3) Resolve an optional variant (by name, case-insensitive, or by id).
      let variantId: string | null = null;
      if (variant) {
        const v =
          drop.variants.find((x) => x.id === variant) ??
          drop.variants.find((x) => x.name.toLowerCase() === variant.toLowerCase());
        if (!v) {
          return fail(
            `variant "${variant}" not found for drop "${drop.name}"`,
            { available: drop.variants.map((x) => x.name) },
          );
        }
        variantId = v.id;
      }

      // 4) Insert through the dedupe funnel: UNIQUE(drop_id, human_key=humanId).
      try {
        const entry = await insertAgentEntry({
          dropId: drop_id,
          humanId: identity.humanId,
          variantId,
          walletAddress: identity.walletAddress, // settles its purchase if it wins (M8)
        });
        return ok(
          {
            entered: true,
            entry_id: entry.id,
            drop: drop.name,
            variant: variantId,
            human_id: identity.humanId,
            wallet: identity.walletAddress,
            agentbook_resolved: identity.agentBookResolved,
            source: "agent",
          },
          `Entered "${drop.name}" — one slot secured for this human.`,
        );
      } catch (err) {
        if (err instanceof AlreadyEnteredError) {
          // The Sybil guarantee firing: this human already holds the one slot.
          return ok(
            {
              entered: false,
              already_entered: true,
              drop: drop.name,
              human_id: identity.humanId,
            },
            `Already entered "${drop.name}" — one slot per human per drop. No second entry created.`,
          );
        }
        throw err;
      }
    },
  );

  // --- check_status (PRIVILEGED) ----------------------------------------------------------
  server.registerTool(
    "check_status",
    {
      title: "Check my entry status",
      description:
        "Check this human's entry status for a drop (pending / won / lost / purchased / " +
        `expired, or not entered). Requires an AgentKit signature in '${AGENTKIT_HEADER}'.`,
      inputSchema: { drop_id: z.string().describe("The drop id (uuid).") },
    },
    async ({ drop_id }) => {
      let identity: AgentIdentity;
      try {
        identity = await requireAgent(req);
      } catch (err) {
        if (err instanceof AgentkitAuthError) {
          return fail(`402 — AgentKit signature required. ${err.message}`, {
            error: "payment_required",
            code: err.code,
          });
        }
        throw err;
      }

      const drop = await getDropWithVariants(drop_id);
      if (!drop) return fail(`drop ${drop_id} not found`);
      const mine = await findEntryByHumanKey(drop_id, identity.humanId);
      return ok(
        {
          drop: drop.name,
          drop_status: drop.status,
          human_id: identity.humanId,
          entered: !!mine,
          entry_status: mine?.status ?? null,
          entry_id: mine?.id ?? null,
          purchase_deadline: mine?.purchaseDeadline ?? null,
        },
        mine
          ? `Your entry in "${drop.name}" is '${mine.status}'.`
          : `You have not entered "${drop.name}".`,
      );
    },
  );

  return server;
}

// One stateless request/response cycle: build server + transport, connect, handle, tear down.
async function handle(req: Request): Promise<Response> {
  const server = buildServer(req);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // STATELESS — auth is per-request, not per-session.
    enableJsonResponse: true, // return a single JSON response (no SSE) for simple clients.
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Best-effort teardown so the per-request server/transport don't leak.
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}

// GET is used by some clients to open an SSE stream; in stateless mode there's no stream to
// resume, so the transport returns the appropriate 405/406. DELETE ends a session (no-op here).
export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function DELETE(req: Request): Promise<Response> {
  return handle(req);
}
