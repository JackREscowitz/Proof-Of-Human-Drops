// M4 acceptance — World ID v4 verify + per-drop nullifier dedupe (web path).
//
// The acceptance test (PRD M4): "A valid v4 proof creates exactly one entries row for
// (drop_id, nullifier); a replay of the same human against the same drop is rejected with
// no new row; the same human against a different drop is accepted."
//
// A real World ID proof cannot be produced headlessly (it requires the World App). So this
// script proves the two halves separately, each against the REAL production code:
//   (A) The verify endpoint is wired to the live World ID v4 RP and rejects an invalid
//       proof — exercised live in the M4 PROGRESS entry via the /enter route (HTTP 422,
//       "All proof verifications failed.").
//   (B) The dedupe invariant — the part a real proof would feed into — is proven HERE by
//       driving the exact production funnel `insertWebEntry()` (the same call the /enter
//       route makes after a successful verify) with a synthetic nullifier:
//         1. nullifier N → Mac Mini            ⇒ inserted (one slot taken)
//         2. nullifier N → Mac Mini (replay)   ⇒ AlreadyEnteredError, NO second row
//         3. nullifier N → Mac Studio (other)  ⇒ inserted (cross-drop action scoping)
//
// Self-cleaning: removes the synthetic entries it creates.
import "dotenv/config";
import { db } from "@/lib/db";
import { drops, entries } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  insertWebEntry,
  AlreadyEnteredError,
  findWebEntry,
  countDropEntries,
} from "@/lib/entries.service";
import { mintRpContext, getRpId } from "@/lib/worldid.service";

let failures = 0;
function ok(cond: boolean, label: string) {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

async function getDropIdByName(name: string): Promise<{ id: string; action: string | null }> {
  const [row] = await db.select().from(drops).where(eq(drops.name, name)).limit(1);
  if (!row) throw new Error(`drop "${name}" not found — run the seed first`);
  return { id: row.id, action: row.worldActionId };
}

// A synthetic but realistically-shaped World ID nullifier (hex, 32 bytes).
const NULLIFIER =
  "0x" + "a4f3c2" + "0".repeat(58); // 0xa4f3c2000…0 (66 chars total)

async function cleanup(nullifier: string) {
  await db.delete(entries).where(eq(entries.humanKey, nullifier));
}

async function main() {
  console.log("M4 acceptance — World ID v4 verify wiring + per-drop nullifier dedupe\n");

  // --- rp_context minting (the server-signed handshake the widget needs) ---
  const mini = await getDropIdByName("Mac Mini");
  const studio = await getDropIdByName("Mac Studio");
  ok(!!mini.action, `Mac Mini has a World ID action (${mini.action})`);
  ok(!!studio.action, `Mac Studio has a World ID action (${studio.action})`);

  const ctx = mintRpContext(mini.action!);
  ok(ctx.rp_id === getRpId(), `rp_context.rp_id == ${getRpId()}`);
  ok(typeof ctx.nonce === "string" && ctx.nonce.length === 66, "rp_context.nonce is 32-byte hex");
  ok(ctx.expires_at - ctx.created_at === 300, "rp_context ttl == 300s");
  ok(typeof ctx.signature === "string" && ctx.signature.length > 100, "rp_context.signature present");

  // --- the dedupe invariant (the heart of M4) ---
  await cleanup(NULLIFIER); // start clean
  const beforeMini = await countDropEntries(mini.id);

  // 1) first entry into Mac Mini
  const e1 = await insertWebEntry({ dropId: mini.id, nullifier: NULLIFIER, verificationLvl: "orb" });
  ok(!!e1.id, "1) nullifier N → Mac Mini: inserted (one slot taken)");
  ok(e1.humanKey === NULLIFIER, "   entry.human_key == nullifier");
  ok(e1.source === "web", "   entry.source == 'web'");
  // nullifier_hash is the decimal form of the hex nullifier
  const expectedDec = BigInt(NULLIFIER).toString(10);
  ok(e1.nullifierHash === expectedDec, "   entry.nullifier_hash == decimal(nullifier)");

  // 2) replay the same human against the same drop → rejected, no new row
  let replayRejected = false;
  try {
    await insertWebEntry({ dropId: mini.id, nullifier: NULLIFIER });
  } catch (err) {
    replayRejected = err instanceof AlreadyEnteredError;
  }
  ok(replayRejected, "2) nullifier N → Mac Mini (replay): AlreadyEnteredError");
  const afterReplay = await countDropEntries(mini.id);
  ok(afterReplay === beforeMini + 1, "   no second row created (count unchanged by replay)");

  // 3) same human, different drop → accepted (per-drop action scoping)
  const e3 = await insertWebEntry({ dropId: studio.id, nullifier: NULLIFIER });
  ok(!!e3.id, "3) nullifier N → Mac Studio (different drop): inserted (cross-drop OK)");
  ok(e3.dropId === studio.id, "   entry recorded against Mac Studio");

  // The same nullifier now appears once per drop — exactly one per (drop, human).
  const inMini = await findWebEntry(mini.id, NULLIFIER);
  const inStudio = await findWebEntry(studio.id, NULLIFIER);
  ok(!!inMini && !!inStudio, "   one entry per drop for this human (Mac Mini + Mac Studio)");

  await cleanup(NULLIFIER);
  const leftover = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.humanKey, NULLIFIER)));
  ok(leftover.length === 0, "cleanup removed all synthetic entries");

  console.log(`\nM4_ACCEPTANCE: ${failures === 0 ? "PASS" : "FAIL"} (${failures} failures)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
