// POST /api/drops/:id/enter (M4) — the web entry path. Verifies a World ID v4 proof
// against the managed RP, then funnels the verified nullifier through the per-drop
// UNIQUE(drop_id, human_key) dedupe. This is the core Sybil guarantee on the web.
//
// Body: { idkitResult: IDKitResult, variantId?: string }
// Returns:
//   201 { ok: true, entry }                              — first entry for this human
//   200 { ok: true, alreadyEntered: true }               — replay of the same human
//   422 { error } / 400 / 404 / 409                       — bad proof / wrong drop / state
import { NextRequest } from "next/server";
import { getDrop } from "@/lib/drops.service";
import {
  verifyV4Proof,
  nullifierFromResult,
  WorldIdVerifyError,
} from "@/lib/worldid.service";
import { insertWebEntry, AlreadyEnteredError } from "@/lib/entries.service";
import { getWallet } from "@/lib/wallets";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Pull the action + a verification level out of the raw IDKit result (best-effort;
// only used to bind the proof to this drop and to record orb vs device).
function actionOf(result: unknown): string | undefined {
  if (typeof result === "object" && result !== null && "action" in result) {
    const a = (result as { action?: unknown }).action;
    return typeof a === "string" ? a : undefined;
  }
  return undefined;
}

function verificationLvlOf(result: unknown): "orb" | "device" | null {
  if (
    typeof result === "object" &&
    result !== null &&
    "responses" in result &&
    Array.isArray((result as { responses?: unknown[] }).responses)
  ) {
    const responses = (result as { responses: Array<{ identifier?: string }> }).responses;
    const id = responses[0]?.identifier;
    // v4 proof-of-human (orb) credential → "orb"; device-only fallbacks → "device".
    if (id === "proof_of_human" || id === "orb") return "orb";
    if (id) return "device";
  }
  return null;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  let body: { idkitResult?: unknown; variantId?: string };
  try {
    body = (await req.json()) as { idkitResult?: unknown; variantId?: string };
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.idkitResult) {
    return Response.json({ error: "idkitResult required" }, { status: 400 });
  }

  const drop = await getDrop(id);
  if (!drop) return Response.json({ error: "drop not found" }, { status: 404 });
  if (drop.status !== "open") {
    return Response.json({ error: `drop is ${drop.status}, not open` }, { status: 409 });
  }
  if (!drop.worldActionId) {
    return Response.json(
      { error: "drop has no World ID action configured" },
      { status: 409 },
    );
  }

  // Bind the proof to THIS drop: the proof's action must equal the drop's action.
  // (Action scoping is what makes "one slot per drop" work while letting a human enter
  // other drops — PRD M4.) Without this check a proof minted for drop A could be posted
  // to drop B's enter route.
  const proofAction = actionOf(body.idkitResult);
  if (proofAction && proofAction !== drop.worldActionId) {
    return Response.json(
      { error: "proof action does not match this drop" },
      { status: 422 },
    );
  }

  // 1) Verify the proof against the World ID v4 managed RP.
  let nullifier: string;
  try {
    const result = await verifyV4Proof(body.idkitResult);
    nullifier = nullifierFromResult(result);
  } catch (err) {
    if (err instanceof WorldIdVerifyError) {
      console.warn(`[drops/${id}/enter] verify failed:`, err.message, err.body);
      return Response.json(
        { error: "World ID verification failed", detail: err.message },
        { status: 422 },
      );
    }
    console.error(`[drops/${id}/enter] verify error:`, err);
    return Response.json({ error: "verification error" }, { status: 500 });
  }

  // For the demo, a verified web human settles their winning purchase from the "human"
  // demo wallet (M9). We store that wallet's address on the entry at entry time so the
  // winner can pay later without re-prompting — the private key is resolved server-side at
  // purchase time and never crosses the wire (mirrors the agent path). If the human wallet
  // isn't configured, fall back to no wallet (purchase route can still take { wallet }).
  let humanWalletAddress: string | null = null;
  try {
    humanWalletAddress = getWallet("human").address;
  } catch {
    humanWalletAddress = null;
  }

  // 2) Funnel through the per-drop unique constraint.
  try {
    const entry = await insertWebEntry({
      dropId: id,
      nullifier,
      variantId: body.variantId ?? null,
      verificationLvl: verificationLvlOf(body.idkitResult),
      walletAddress: humanWalletAddress,
    });
    return Response.json({ ok: true, entry }, { status: 201 });
  } catch (err) {
    if (err instanceof AlreadyEnteredError) {
      // Friendly "you're already entered" — the Sybil block in action.
      return Response.json({ ok: true, alreadyEntered: true }, { status: 200 });
    }
    console.error(`[drops/${id}/enter] insert error:`, err);
    return Response.json({ error: "failed to record entry" }, { status: 500 });
  }
}
