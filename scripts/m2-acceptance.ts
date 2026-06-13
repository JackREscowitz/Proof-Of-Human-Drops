// M2 acceptance test (PRD M2): proves the Sybil-guarantee unique constraint.
//   - Inserting two `entries` rows with the SAME (drop_id, human_key) FAILS (23505).
//   - Inserting with a DIFFERENT human_key SUCCEEDS.
// Also dumps the table list + key column types as evidence. Self-cleaning: it creates a
// throwaway drop and deletes it (cascades the entries) at the end.
//
// Run: pnpm exec tsx scripts/m2-acceptance.ts   (uses DATABASE_URL from .env)

import postgres from "postgres";
import { config } from "dotenv";

config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

async function main() {
  let pass = true;

  // --- Evidence: tables + critical types -----------------------------------
  const tables = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE' order by table_name`;
  const names = tables.map((t) => t.table_name);
  console.log("TABLES:", names.join(", "));
  const expected = ["agents", "drops", "entries", "orders", "sessions", "variants"];
  const missing = expected.filter((e) => !names.includes(e));
  if (missing.length) {
    console.error("MISSING TABLES:", missing.join(", "));
    pass = false;
  }

  const uniq = await sql<{ conname: string; def: string }[]>`
    select conname, pg_get_constraintdef(oid) as def
    from pg_constraint where conrelid='entries'::regclass and contype='u'`;
  console.log("ENTRIES UNIQUE:", uniq.map((u) => `${u.conname} ${u.def}`).join(" | "));
  const hasSybil = uniq.some((u) => /\(drop_id, human_key\)/.test(u.def));
  if (!hasSybil) {
    console.error("MISSING UNIQUE(drop_id, human_key)");
    pass = false;
  }

  // --- The actual constraint test ------------------------------------------
  const [drop] = await sql<{ id: string }[]>`
    insert into drops (name, status) values ('M2 throwaway', 'open') returning id`;
  const dropId = drop.id;

  try {
    // 1) First insert with human_key='HUMAN_A' must succeed.
    await sql`insert into entries (drop_id, human_key, source) values (${dropId}, 'HUMAN_A', 'web')`;
    console.log("OK: first entry (HUMAN_A) inserted");

    // 2) Duplicate (same drop_id, same human_key) must FAIL with 23505.
    let dupRejected = false;
    try {
      await sql`insert into entries (drop_id, human_key, source) values (${dropId}, 'HUMAN_A', 'agent')`;
    } catch (err) {
      if (isUniqueViolation(err)) {
        dupRejected = true;
        console.log("OK: duplicate (drop_id, HUMAN_A) rejected with unique violation (23505)");
      } else {
        throw err;
      }
    }
    if (!dupRejected) {
      console.error("FAIL: duplicate (drop_id, HUMAN_A) was NOT rejected");
      pass = false;
    }

    // 3) Different human_key in the same drop must SUCCEED.
    await sql`insert into entries (drop_id, human_key, source) values (${dropId}, 'HUMAN_B', 'web')`;
    console.log("OK: second distinct entry (HUMAN_B) inserted");

    // 4) Confirm exactly 2 rows for this drop.
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int as count from entries where drop_id=${dropId}`;
    console.log("ENTRY COUNT for throwaway drop:", count);
    if (count !== 2) {
      console.error(`FAIL: expected 2 entries, got ${count}`);
      pass = false;
    }
  } finally {
    // Clean up: deleting the drop cascades to its entries.
    await sql`delete from drops where id=${dropId}`;
    console.log("cleaned up throwaway drop");
  }

  await sql.end();
  console.log(pass ? "\nM2_ACCEPTANCE: PASS" : "\nM2_ACCEPTANCE: FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch(async (err) => {
  console.error("M2_ACCEPTANCE: ERROR", err);
  try {
    await sql.end();
  } catch {}
  process.exit(1);
});
