// Entry service (M4) — the per-drop dedupe funnel. EVERY entry path (web nullifier,
// agent humanId) must go through `insertEntry` so it hits UNIQUE(drop_id, human_key) —
// that constraint IS the Sybil guarantee (RALPH_GUIDE.md §7). Never raw-insert around it.

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries, type Entry } from "@/lib/db/schema";

export class AlreadyEnteredError extends Error {
  constructor(public readonly dropId: string) {
    super("already entered this drop");
  }
}

// Postgres unique-violation SQLSTATE. The driver (postgres.js) surfaces it as `.code`.
const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  // Drizzle wraps the driver error in DrizzleQueryError; the postgres.js SQLSTATE lives on
  // `err.cause.code`. A raw postgres.js error exposes it directly on `err.code`. Check both
  // so the dedupe works whether the insert goes through drizzle or the raw client.
  if (typeof err !== "object" || err === null) return false;
  const direct = (err as { code?: string }).code;
  const cause = (err as { cause?: { code?: string } }).cause?.code;
  return direct === PG_UNIQUE_VIOLATION || cause === PG_UNIQUE_VIOLATION;
}

// World ID nullifiers are hex (e.g. "0x2bf8…"). `human_key` stores the hex string verbatim
// (the dedupe key); `nullifier_hash` is numeric(78,0), so convert hex → decimal string.
function hexToDecimalString(hex: string): string {
  const clean = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (clean.length === 0) return "0";
  return BigInt("0x" + clean).toString(10);
}

export interface InsertWebEntryInput {
  dropId: string;
  nullifier: string; // verified World ID v4 nullifier (hex)
  variantId?: string | null;
  verificationLvl?: "orb" | "device" | null;
  // The wallet this entry settles FROM if it wins (M6). For the demo, a web human maps to a
  // demo wallet (e.g. the "human" wallet). Stored so the winner can pay without re-prompting.
  walletAddress?: string | null;
}

// Insert a WEB entry keyed by the World ID nullifier. Returns the new row on success;
// throws AlreadyEnteredError if this human already entered THIS drop (unique violation).
export async function insertWebEntry(input: InsertWebEntryInput): Promise<Entry> {
  try {
    const [row] = await db
      .insert(entries)
      .values({
        dropId: input.dropId,
        humanKey: input.nullifier, // ★ the dedupe key — UNIQUE(drop_id, human_key)
        source: "web",
        nullifierHash: hexToDecimalString(input.nullifier),
        verificationLvl: input.verificationLvl ?? null,
        variantId: input.variantId ?? null,
        walletAddress: input.walletAddress ?? null,
      })
      .returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new AlreadyEnteredError(input.dropId);
    throw err;
  }
}

// Has this human (by nullifier) already entered this drop? Used to render UI state
// without attempting an insert.
export async function findWebEntry(
  dropId: string,
  nullifier: string,
): Promise<Entry | undefined> {
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.dropId, dropId), eq(entries.humanKey, nullifier)))
    .limit(1);
  return row;
}

// Count of UNIQUE humans entered in a drop = number of entry rows (the unique constraint
// guarantees one row per human). Drives the fairness panel (M9).
export async function countDropEntries(dropId: string): Promise<number> {
  const rows = await db
    .select({ id: entries.id })
    .from(entries)
    .where(eq(entries.dropId, dropId));
  return rows.length;
}
