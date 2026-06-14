// POST /api/drops/:id/enter (M4) — the web entry path. Funnels a verified human through the
// per-drop UNIQUE(drop_id, human_key) dedupe. This is the core Sybil guarantee on the web.
//
// TWO ways to be a "verified human" here:
//   1. SESSION (preferred — "sign in once, then 1-tap join"): the visitor signed in with
//      World ID earlier (POST /api/auth/signin) and carries a session cookie. We reuse the
//      session's stored nullifier as the human key — NO re-scan, no body needed.
//   2. PROOF (back-compat / no session): the body carries a fresh IDKitResult for THIS
//      drop's action; we verify it live and use that nullifier.
//
// Body: { idkitResult?: IDKitResult, variantId?: string }   (idkitResult optional if signed in)
// Returns:
//   201 { ok: true, entry }                              — first entry for this human
//   200 { ok: true, alreadyEntered: true }               — replay of the same human
//   401 { error }                                        — not signed in AND no proof supplied
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
import { getSession } from "@/lib/session";

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

  // Body is optional when signed in (1-tap join). Tolerate an empty/missing body.
  let body: { idkitResult?: unknown; variantId?: string } = {};
  try {
    const parsed = (await req.json()) as { idkitResult?: unknown; variantId?: string };
    if (parsed && typeof parsed === "object") body = parsed;
  } catch {
    // no/invalid body — fine if the visitor is signed in
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

  // Resolve the verified human key by one of two paths.
  let nullifier: string;
  let verificationLvl: "orb" | "device" | null = null;

  const session = await getSession();
  if (session) {
    // Path 1 — signed in once with World ID. Reuse the session's human key (the nullifier
    // from the `signin` action). Same key across drops → UNIQUE(drop_id, human_key) still
    // gives one entry per human per drop, with no re-scan.
    nullifier = session.humanKey;
    verificationLvl = session.verificationLvl;
  } else if (body.idkitResult) {
    // Path 2 — no session: verify a fresh proof for THIS drop's action (back-compat).
    // Bind the proof to THIS drop: the proof's action must equal the drop's action so a
    // proof minted for drop A can't be posted to drop B's enter route.
    const proofAction = actionOf(body.idkitResult);
    if (proofAction && proofAction !== drop.worldActionId) {
      return Response.json(
        { error: "proof action does not match this drop" },
        { status: 422 },
      );
    }
    try {
      const result = await verifyV4Proof(body.idkitResult);
      nullifier = nullifierFromResult(result);
      verificationLvl = verificationLvlOf(body.idkitResult);
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
  } else {
    // Neither signed in nor a proof supplied.
    return Response.json(
      { error: "sign in with World ID first" },
      { status: 401 },
    );
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
      verificationLvl,
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
