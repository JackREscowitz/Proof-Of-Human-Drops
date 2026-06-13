// M3 acceptance test (PRD M3): full lifecycle via the admin API against a running server.
//   create drop → open → (insert dummy entry) → reset → confirm entries empty + status 'open'.
// Also checks: unauth calls are 401, seed creates the two demo items, /api/drops lists them.
//
// Run against a base URL (default local):
//   BASE_URL=http://localhost:3000 ADMIN_SECRET=... pnpm exec tsx scripts/m3-acceptance.ts
//   BASE_URL=https://worldcoinapp-production.up.railway.app ADMIN_SECRET=... pnpm exec tsx scripts/m3-acceptance.ts
import { config } from "dotenv";
config();

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.ADMIN_SECRET;
if (!SECRET) {
  console.error("ADMIN_SECRET not set");
  process.exit(1);
}

let pass = true;
const authH = { "content-type": "application/json", "x-admin-secret": SECRET };

function check(cond: boolean, label: string) {
  console.log(`${cond ? "OK  " : "FAIL"} ${label}`);
  if (!cond) pass = false;
}

async function j(res: Response) {
  return res.json().catch(() => ({}));
}

async function main() {
  console.log(`BASE_URL = ${BASE}`);

  // 0) Unauth admin call is rejected.
  const noauth = await fetch(`${BASE}/api/admin/drops`);
  check(noauth.status === 401, `GET /api/admin/drops without secret → 401 (got ${noauth.status})`);

  // 1) Seed the demo; expect Mac Mini (open) + Mac Studio (coming_soon).
  const seedRes = await fetch(`${BASE}/api/admin/seed`, { method: "POST", headers: authH });
  const seed = await j(seedRes);
  check(seedRes.status === 200 && seed.ok, `POST /api/admin/seed → 200 ok`);
  const seededNames = (seed.drops ?? []).map((d: any) => d.name);
  check(
    seededNames.includes("Mac Mini") && seededNames.includes("Mac Studio"),
    `seed created Mac Mini + Mac Studio (got: ${seededNames.join(", ")})`,
  );

  // 2) Public /api/drops lists them with statuses/variants.
  const pub = await j(await fetch(`${BASE}/api/drops`));
  const macMini = (pub.drops ?? []).find((d: any) => d.name === "Mac Mini");
  const macStudio = (pub.drops ?? []).find((d: any) => d.name === "Mac Studio");
  check(!!macMini && macMini.status === "open", `Mac Mini present and open`);
  check(!!macStudio && macStudio.status === "coming_soon", `Mac Studio present and coming_soon`);
  check((macMini?.variants?.length ?? 0) === 2, `Mac Mini has 2 variants`);

  const dropId = macMini.id;

  // 3) Create a fresh throwaway drop → open → dummy entry → reset → assert empty + open.
  const createdRes = await fetch(`${BASE}/api/admin/drops`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({ name: "M3 Lifecycle Test", status: "coming_soon" }),
  });
  const created = await j(createdRes);
  check(createdRes.status === 201 && created.drop?.id, `POST /api/admin/drops (create) → 201`);
  const tId = created.drop.id;

  const opened = await j(
    await fetch(`${BASE}/api/admin/drops/${tId}/open`, { method: "POST", headers: authH }),
  );
  check(opened.drop?.status === "open", `transition coming_soon → open`);

  // insert two dummy entries
  await fetch(`${BASE}/api/admin/drops/${tId}/dummy-entry`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({ humanKey: "lifecycle-A" }),
  });
  await fetch(`${BASE}/api/admin/drops/${tId}/dummy-entry`, {
    method: "POST",
    headers: authH,
    body: JSON.stringify({ humanKey: "lifecycle-B" }),
  });
  const afterEntries = await j(
    await fetch(`${BASE}/api/admin/drops/${tId}`, { headers: authH }),
  );
  check(afterEntries.entryCount === 2, `2 dummy entries inserted (got ${afterEntries.entryCount})`);

  // reset → entries empty, status open
  const reset = await j(
    await fetch(`${BASE}/api/admin/drops/${tId}/reset`, { method: "POST", headers: authH }),
  );
  check(reset.drop?.status === "open", `reset → status open`);
  const afterReset = await j(
    await fetch(`${BASE}/api/admin/drops/${tId}`, { headers: authH }),
  );
  check(afterReset.entryCount === 0, `reset truncated entries (got ${afterReset.entryCount})`);

  // 4) Invalid transition is rejected (open → settled is not allowed directly).
  const badRes = await fetch(`${BASE}/api/admin/drops/${tId}/settle`, {
    method: "POST",
    headers: authH,
  });
  check(badRes.status === 409, `invalid transition open → settled → 409 (got ${badRes.status})`);

  // 5) flip coming_soon: Mac Studio coming_soon → open → back
  const flip1 = await j(
    await fetch(`${BASE}/api/admin/drops/${macStudio.id}/flip`, { method: "POST", headers: authH }),
  );
  check(flip1.drop?.status === "open", `flip Mac Studio coming_soon → open`);
  const flip2 = await j(
    await fetch(`${BASE}/api/admin/drops/${macStudio.id}/flip`, { method: "POST", headers: authH }),
  );
  check(flip2.drop?.status === "coming_soon", `flip Mac Studio open → coming_soon`);

  // cleanup throwaway drop
  const del = await fetch(`${BASE}/api/admin/drops/${tId}`, { method: "DELETE", headers: authH });
  check(del.status === 200, `DELETE throwaway drop → 200 (got ${del.status})`);
  void dropId;

  console.log(pass ? "\nM3_ACCEPTANCE: PASS" : "\nM3_ACCEPTANCE: FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error("M3_ACCEPTANCE: ERROR", err);
  process.exit(1);
});
