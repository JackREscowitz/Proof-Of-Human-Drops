# PROGRESS.md — build-loop ledger

> The Ralph loop's only cross-iteration memory. **Append** one entry per iteration
> (never rewrite history). Stamp the milestone id (e.g. `M3`) in every entry. When a
> milestone passes its Acceptance Test, mark `Status of M<N>: ACCEPTED` — the next
> iteration skips it without re-testing. Never put secrets (private keys, DB passwords)
> here; reference them by file/name only. Format spec: `RALPH_GUIDE.md` §12.

## Milestone status at a glance
- **M0 — Repo & toolchain bootstrap:** ACCEPTED
- **M1 — Railway connectivity + Docker deploy (Railway CLI):** ACCEPTED
- **M2 — DB schema + migrations (Drizzle + Railway Postgres):** ACCEPTED
- **M3 — Drop/variant domain + admin/reset plane:** ACCEPTED
- **M4 — World ID v4 verify + per-drop dedupe (web):** ACCEPTED
- M5 — USDC settlement (viem, chain 4801): not started
- M6 — Fair draw engine + winner purchase window: not started
- M7 — MCP server: info + entry tools (AgentKit auth): not started
- M8 — MCP purchase tool + e2e agent settlement: not started
- M9 — Web purchase UI + pop-brutalist design pass: not started
- M10 — Demo hardening + reset choreography + dry run: not started

---

## 2026-06-13 — iter-001 — M0 Repo & toolchain bootstrap
**Status of M0:** ACCEPTED

**Did:**
- Found a partially-scaffolded Next.js app already present (Next **16.2.9**, App Router,
  Tailwind **v4**, **no** `src/` dir — code lives in `app/`, `components/`, `lib/` at repo
  root). No prior git commits existed. Completed the M0 build steps on top of it:
  - `next.config.ts`: added `output: "standalone"` (for the M1 Docker image).
  - `package.json` scripts: added `typecheck` (`tsc --noEmit`) and `db:generate` /
    `db:migrate` / `db:studio` placeholders (echo + exit 0 until M2 wires Drizzle).
  - `app/page.tsx`: replaced the create-next-app boilerplate with a minimal
    "Proof-of-Human Drops" landing (full pop-brutalist design is deferred to M9).
  - `app/layout.tsx`: set real `metadata` (title/description). Geist fonts already wired.
  - `app/api/health/route.ts`: `GET` → `Response.json({ ok: true })`, `force-dynamic`.
  - Initialized **shadcn/ui** via `pnpm dlx shadcn@latest init --defaults --yes`
    (preset `base-nova`). It created `components.json`, `components/ui/button.tsx`,
    `lib/utils.ts` (`cn()`), rewrote `app/globals.css` with the full theme-token system
    (light/dark CSS vars), and added deps: `@base-ui/react`, `class-variance-authority`,
    `clsx`, `lucide-react`, `tailwind-merge`, `tw-animate-css`, `shadcn`.
  - `.gitignore`: added `.ralph/` (loop runtime logs — not source).
- Committed everything on branch `build/m0-bootstrap` (this repo's first commit).

**Acceptance test (literal output):**
- `pnpm typecheck` → `TYPECHECK_EXIT=0`.
- `pnpm build` → `✓ Compiled successfully`, `BUILD_EXIT=0`. Routes: `○ /`,
  `○ /_not-found`, `ƒ /api/health`. `.next/standalone/server.js` (6.6K) produced.
- Production server (`pnpm start`, PORT=3000): `curl -s localhost:3000/api/health`
  → `{"ok":true}`; `curl -s localhost:3000/` contains `Proof-of-Human Drops`.
- Also de-risked M1: after `cp -r public .next/standalone/ && cp -r .next/static
  .next/standalone/.next/`, `node .next/standalone/server.js` (PORT=3001) also returned
  `{"ok":true}` from `/api/health`.
- Secrets check: `git check-ignore secret_keys demo_wallets.md .mcp.json` → all ignored;
  `git status` shows none of them tracked.

**Deviations from PRD:**
- PRD M0 step 2 suggested `--src-dir`; the pre-existing scaffold uses **no** `src/` dir
  (root-level `app/`/`components/`/`lib/`). Kept it as-is — `@/*` alias maps to `./*` in
  `tsconfig.json`, so `@/components`, `@/lib/utils` resolve correctly. No reason to churn.
- PRD says `next.config.js`; this scaffold uses **`next.config.ts`** (TS config). Same effect.
- shadcn `--base radix` prompted interactively; `--defaults` (preset `base-nova`, which
  pulls `@base-ui/react` rather than radix) ran non-interactively and is fine for our needs.

**NOTES FOR NEXT ITERATION (start M1 — Railway + Docker):**
- ⚠️ **`output: "standalone"` means `next start` is NOT the prod runner.** `pnpm start`
  works but prints a warning; the Docker CMD must be `node server.js` (run from
  `.next/standalone/`). The standalone server does **not** auto-copy `public/` or
  `.next/static/` — the Dockerfile MUST `cp -r public .next/standalone/` and
  `cp -r .next/static .next/standalone/.next/static` (verified locally this makes
  `/api/health` serve correctly).
- Toolchain: Node v22.20.0, pnpm 10.18.1. Next **16.2.9** uses **Turbopack** for builds.
  Railway CLI is **NOT installed yet** — M1 installs it (`npm i -g @railway/cli`) and will
  likely need a **human OAuth/browser step** to authenticate (`railway login`); if so,
  write the exact instruction to `## BLOCKED` and pause M1.
- ‼️ **READ `node_modules/next/dist/docs/` before writing Next code** — per `AGENTS.md`
  this is a modified Next.js with breaking changes. Route handlers + `output: standalone`
  behaved per the bundled docs (`.../05-config/.../output.md`, `.../03-file-conventions/route.md`).
- Repo layout reminder: root-level `app/`, `components/ui/`, `lib/`. Health route at
  `app/api/health/route.ts`. shadcn `button` already available at
  `@/components/ui/button`; add more with `pnpm dlx shadcn@latest add <name>`.
- Resource files (gitignored, present in repo root): `secret_keys`, `demo_wallets.md`.
  MCP servers configured: `world-developer-portal` (authed, ready), `railway` (needs OAuth).
- No `.env` exists yet — M2 will create one from `secret_keys` (compose `DATABASE_URL`
  with `?sslmode=require`). Keep it gitignored (already covered by `.gitignore`).
  > **⚠️ SUPERSEDED 2026-06-13 — see iter-002 below.** DB is now **Railway Postgres**,
  > not DigitalOcean. `secret_keys` has **no** DB creds; `DATABASE_URL` comes from the
  > Railway Postgres service. There is **no `?sslmode=require`** to compose. Follow the
  > iter-002 note for M1/M2.

---

## 2026-06-13 — iter-002 — DB migration note: DigitalOcean → Railway Postgres
**Status of M0:** ACCEPTED (unchanged). No milestone advanced this iteration — docs only.

**Did:**
- Per user instruction, updated the build docs to use the **Railway CLI for all Railway
  operations** and **Railway Postgres instead of DigitalOcean** managed Postgres. Edited
  `PRD.md` (§0 ground-truth table, §2 loop contract, M1, M2) and `RALPH_GUIDE.md` (§3 hard
  constraints, §4 `secret_keys` description, §5 ground-truth table + Railway MCP note, §6
  stack). No code changed; no milestone re-tested.
- Confirmed `secret_keys` contains **only** World ID keys + the Agent wallet — **no DB
  credentials**. (This corrected a now-false claim in `RALPH_GUIDE.md` §4 that DO Postgres
  parts lived there.)

**RAILWAY — CLI installed & authenticated (do not re-do):**
- CLI **5.12.1 installed and authenticated** as `carson@taho.is`, workspace "Carson Weeks's
  Projects" (`7d9ecc4f-6112-47d4-be53-582300536823`). `railway whoami --json` confirms.
- **Project ALREADY EXISTS — LINK, never create:** `worldcoin_app`
  id `c3751ac9-2806-4e9e-83d7-30504b6a059f`, env `production` `928cd32e-b60e-43b3-86f7-2c7bbcb9476d`.
  **No services yet** (empty). M1 links + adds the app service; M2 adds Postgres — both INTO
  this project. Link with:
  `railway link --project c3751ac9-2806-4e9e-83d7-30504b6a059f --environment production`.
  (Ignore the unrelated `distinguished-caring` project in the same workspace.)

**NOTES FOR NEXT ITERATION — these OVERRIDE the iter-001 DB notes above:**
- **All Railway ops go through the `use-railway` skill / `railway` CLI** (`railway up`,
  `railway add`, `railway variables`, `railway domain`, `railway status`). Use `--json`;
  never report a deploy done before `railway deployment list --json` shows terminal
  `SUCCESS`. The Railway MCP is only an OAuth-read convenience.
- **M1** links the existing project (above), adds the app service, deploys the Dockerfile.
- **M2** adds Postgres INTO `worldcoin_app` with `railway add --database postgres --json`
  (check `railway service list --json` first — **never recreate** if one exists). Record
  the DB service name/ID here.
- **M2 DB wiring (replaces the `?sslmode=require` instruction):** Railway Postgres injects
  `DATABASE_URL` as a service variable. **No** host/port/user assembly, **no** SSL flag.
  - App service (on Railway): reference the private URL — e.g.
    `railway variables --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}'` on the app service.
  - Local dev: pull `DATABASE_PUBLIC_URL` via `railway variables --json` into `.env`
    (gitignored). Run migrations locally against the public URL, or `railway run pnpm db:migrate`.
- **Do not delete** the Railway project/service or the Railway Postgres database service
  (slow to recreate). Clearing tables/rows is still fine.

---

## 2026-06-13 — iter-003 — M1 Railway connectivity + Docker deploy
**Status of M1:** ACCEPTED

**Did:**
- Branched `build/m1-railway-deploy` off `build/m0-bootstrap`. Three commits:
  - `dd778cc` — carried the uncommitted iter-002 doc edits (Railway migration across
    PRD/RALPH_GUIDE/CLAUDE.md/ralph.sh) + `package.json` `packageManager: pnpm@10.18.1` pin.
  - `8ad060a` — `Dockerfile` (multi-stage Next standalone) + `.dockerignore`.
  - `19a7ded` — **Dockerfile fix** that unblocked the Railway build (see Deviations).
- **Dockerfile** (final): `node:22.20.0-slim` base, Corepack/pnpm. Stages: `deps`
  (`pnpm install --frozen-lockfile`), `build` (`pnpm build`, then `cp -r public
  .next/standalone/` and `cp -r .next/static .next/standalone/.next/static`), `runner`
  (non-root `nextjs` user, `CMD ["node","server.js"]`, EXPOSE 3000, honors `PORT`/`HOSTNAME`).
- **`.dockerignore`** excludes node_modules, .next, .git, secrets (`secret_keys`,
  `demo_wallets.md`, `.env*`, `*.key`, `*.pem`), `.mcp.json`, `.claude`, `.ralph`, `*.md`,
  `webinspo/`.
- Railway: linked the **existing** project (no new project created). `railway up` created
  **one app service**, deployed the Dockerfile, generated a public domain. Verified live.

**RAILWAY IDs (record — do not recreate):**
- Project `worldcoin_app` = `c3751ac9-2806-4e9e-83d7-30504b6a059f`, env `production`
  = `928cd32e-b60e-43b3-86f7-2c7bbcb9476d` (unchanged, linked not created).
- **App service `worldcoin_app` (the SAME name as the project) = `9f74a937-4034-4767-8fd0-67115833c31d`.**
  This is the Next.js app service created by `railway up`. Builder = `DOCKERFILE`,
  dockerfilePath `/Dockerfile`. (CLI link in `~/.railway/config.json` has `service: null`,
  so pass `--service 9f74a937-4034-4767-8fd0-67115833c31d` explicitly on every CLI call,
  or run `railway service` to link it.)
- **Live public URL: `https://worldcoinapp-production.up.railway.app`** (port served on
  Railway's injected `PORT`, observed `8080` in runtime logs; app binds `0.0.0.0`).
- Successful deployment id: `ea337c34-e852-4311-a2da-ac7cecf1ec3a` (status `SUCCESS`).

**Acceptance test (literal output):**
- `railway deployment list --service 9f74a937... --json` → newest
  `ea337c34-e852-4311-a2da-ac7cecf1ec3a` **SUCCESS**.
- `curl -s https://worldcoinapp-production.up.railway.app/api/health` → `{"ok":true}`
  (HTTP 200, first attempt after domain creation).
- `curl -s https://worldcoinapp-production.up.railway.app/` → contains
  `Proof-of-Human Drops`.
- Runtime logs: `▲ Next.js 16.2.9 … ✓ Ready in 0ms … Starting Container` on
  `http://0.0.0.0:8080`.
- Local pre-flight: `docker build .` succeeded; `docker run` served
  `/api/health → {"ok":true}` on a mapped port before deploying.

**Deviations from PRD:**
- ‼️ **Railway's Metal builder rejected the original Dockerfile.** First two deploy
  attempts FAILED in ~4s at the `BUILD_IMAGE` step with **no Docker output** (only
  "scheduling build on Metal builder" twice). `SNAPSHOT_CODE` succeeded, so the upload was
  fine. Root cause: the `# syntax=docker/dockerfile:1` directive (external BuildKit
  frontend pull) and the `RUN --mount=type=cache,id=pnpm,target=/pnpm/store` cache mount.
  **Removed both** (commit `19a7ded`) — they're optimizations, not requirements — and the
  build ran to completion on Railway. **Local `docker build` was a false-green: it works
  with those features; Railway does not.** ⇒ **For any future Dockerfile work, do NOT add a
  `# syntax=` directive or BuildKit `--mount=type=cache` — the Railway Metal builder fails
  them silently.**
- Diagnosis path that worked when CLI logs were empty: Railway GraphQL at
  `https://backboard.railway.com/graphql/v2` with the OAuth `accessToken` from
  `~/.railway/config.json` (`.user.accessToken`, NOT `.user.token` which is null — the
  bundled `scripts/railway-api.sh` reads `.user.token` and therefore prints "No Railway
  token found"; call the API with curl + `Authorization: Bearer <accessToken>` instead).
  `deploymentEvents(id:)` returns the per-step `step`/`completedAt` that pinpointed
  `BUILD_IMAGE` as the failing step.
- `railway up` initial form: had to pass `--service <id>` once the service existed
  ("Multiple services found"). Used `railway up --ci --service <id>` for an authoritative
  streaming deploy (exit 0 = deployed).

**NOTES FOR NEXT ITERATION (start M2 — DB schema + migrations):**
- **Provision Postgres INTO `worldcoin_app`** (do NOT recreate if present — check
  `railway service list --json` first): `railway add --database postgres --json`. Record
  the DB service name/ID in PROGRESS.md.
- **DB wiring** (per iter-002 notes, still current): app service references
  `DATABASE_URL=${{Postgres.DATABASE_URL}}` (set with `railway variables --set` on service
  `9f74a937-4034-4767-8fd0-67115833c31d`); local dev pulls `DATABASE_PUBLIC_URL` into a
  gitignored `.env`. No `sslmode` ceremony.
- Add `drizzle-orm` + `drizzle-kit` + `postgres` (or `pg`) driver; wire the `db:*` scripts
  (currently echo-placeholders in `package.json`). Schema: `drops`, `variants`, `entries`,
  `agents`, `sessions`, `orders`. **Invariant: `entries UNIQUE(drop_id, human_key)`**;
  nullifier as `NUMERIC(78,0)`; USDC as `NUMERIC(20,6)`.
- Add `/api/health/db` (`SELECT 1` → `{"db":"ok"}`); redeploy and confirm it's green on the
  live URL too (proves app↔Postgres over Railway's private network). **Remember: each CLI
  call needs `--service 9f74a937-4034-4767-8fd0-67115833c31d`** (or `railway service` to
  link it) since the config link has `service: null`.
- Redeploy command that works: `railway up --ci --service 9f74a937-4034-4767-8fd0-67115833c31d -m "<msg>"`.
- No secrets were committed; `.dockerignore` + `.gitignore` both exclude the resource files.

---

## 2026-06-13 — iter-003 (cont.) — M2 DB schema + migrations (Drizzle + Railway Postgres)
**Status of M2:** ACCEPTED

**Did:** (same branch `build/m1-railway-deploy`, continued after M1)
- **Provisioned Railway Postgres** into `worldcoin_app` via `railway add --database postgres`.
  DB service **`Postgres` = `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`** (volume-backed, region iad).
- **Wired DATABASE_URL:** app service references `DATABASE_URL=${{Postgres.DATABASE_URL}}`
  (private network) — set with `railway variables --set` on service `9f74a937...`. Local dev
  pulls `DATABASE_PUBLIC_URL` (TCP proxy `thomas.proxy.rlwy.net:23073`) into a gitignored `.env`.
- **Schema** (`lib/db/schema.ts`, Drizzle): 6 tables `drops`, `variants`, `entries`, `agents`,
  `sessions`, `orders` + 5 enums. `entries UNIQUE(drop_id, human_key)` = the Sybil guarantee;
  `nullifier_hash numeric(78,0)`; `price_usdc`/`amount_usdc numeric(20,6)`. Added two
  forward-looking columns on `drops`: `draw_seed` (M6 seedable RNG) and `world_action_id` (M4).
- **DB client** `lib/db/index.ts`: postgres.js + drizzle singleton, **lazy** (see Deviations).
- **Migrations:** `drizzle.config.ts` + `lib/db/migrate.ts` (tsx runner, loads `.env` via dotenv).
  `pnpm db:generate` → `drizzle/0000_cuddly_roland_deschain.sql`; `pnpm db:migrate` applied it to
  Railway Postgres. `package.json` `db:*` scripts now real (were echo placeholders): `db:generate`
  (drizzle-kit generate), `db:migrate` (tsx lib/db/migrate.ts), `db:studio`, `db:push`.
- **Health route** `app/api/health/db/route.ts`: `SELECT 1` → `{"db":"ok"}` (503 on error).
- **Acceptance script** `scripts/m2-acceptance.ts`: proves the unique constraint (self-cleaning).
- Deps added: `drizzle-orm@0.45.2`, `postgres@3.4.9`, `drizzle-kit@0.31.10` (dev), `tsx`, `dotenv`.

**Commits:** `525f36e` (schema+migrations+route+test), `5b3267e` (lazy DB client build fix).

**Acceptance test (literal output):**
- `pnpm exec tsx scripts/m2-acceptance.ts` →
  ```
  TABLES: agents, drops, entries, orders, sessions, variants
  ENTRIES UNIQUE: entries_drop_human_key_unique UNIQUE (drop_id, human_key)
  OK: first entry (HUMAN_A) inserted
  OK: duplicate (drop_id, HUMAN_A) rejected with unique violation (23505)
  OK: second distinct entry (HUMAN_B) inserted
  ENTRY COUNT for throwaway drop: 2
  M2_ACCEPTANCE: PASS
  ```
- Live (Railway, private-network DB): newest deployment `360cf1a2-5a0e-40bb-ab84-1ee63b98ac3a`
  **SUCCESS**; `curl https://worldcoinapp-production.up.railway.app/api/health/db` → `{"db":"ok"}`
  (and `/api/health` → `{"ok":true}`). Local standalone server also returned `{"db":"ok"}`.

**Deviations from PRD:**
- ‼️ **Lazy DB client was required.** First M2 deploy FAILED at `next build`'s "collecting page
  data": `Failed to collect page data for /api/health/db — DATABASE_URL is not set`. Next.js
  evaluates route modules at build time, where the Docker build stage has no `DATABASE_URL`
  (runtime-only on Railway). Original client connected at module load → threw. Fixed by wrapping
  `db`/`sql` in lazy Proxies (connect on first use). **Verify locally with
  `env -u DATABASE_URL pnpm build` — it must succeed.** (Memory saved.)
- Driver choice: `postgres` (postgres.js) over `pg` — lighter, first-class with
  `drizzle-orm/postgres-js`. Either is allowed by the PRD.
- Added `db:push` script (not in PRD) as a dev convenience; migrations remain the source of truth.

**NOTES FOR NEXT ITERATION (start M3 — Drop/variant domain + admin/reset plane):**
- **Still on branch `build/m1-railway-deploy`.** Consider opening `build/m3-admin-plane` off it,
  or just continue — either is fine (no PR has been opened; nothing merged to main yet).
- Build `lib/drops.service.ts` (plain TS): create drop, add variants, status transitions
  (`coming_soon→open→closed→settled`), **reset drop** (truncate entries+orders for that drop_id,
  set `open`, reset countdown). Use the Drizzle `db` from `@/lib/db` (note: it's a lazy proxy —
  works exactly like a normal drizzle db at runtime).
- Admin API routes `/api/admin/*` gated by **`ADMIN_SECRET`** (header or query). Add `ADMIN_SECRET`
  to `.env` locally AND to the Railway app service via `railway variables --set ADMIN_SECRET=...
  --service 9f74a937-4034-4767-8fd0-67115833c31d` (pick a value, record that it's set — not the
  value — here). Endpoints: create/open/close/settle, set/get seed, reset drop, flip coming_soon↔open,
  force-draw (M6).
- Seed script: "Mac Mini" drop (variants Silver/Black, total_slots=1, price_usdc=10, status open)
  + a "coming soon" second item (e.g. "Mac Studio") with variants.
- Minimal `/admin` page behind the secret (can be ugly).
- **Reusable facts:** Railway app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live URL `https://worldcoinapp-production.up.railway.app`.
  Migrations: edit schema → `pnpm db:generate` → `pnpm db:migrate` (local, hits Railway via public
  proxy in `.env`). Redeploy: `railway up --ci --service 9f74a937... -m "<msg>"`. DB column naming
  in SQL is snake_case (drop_id, human_key, price_usdc, etc.); Drizzle TS uses camelCase fields.

---

## 2026-06-13 — iter-003 (cont.) — M3 Drop/variant domain + admin/reset plane
**Status of M3:** ACCEPTED

**Did:** (new branch `build/m3-admin-plane` off `build/m1-railway-deploy`)
- **`ADMIN_SECRET`** generated (32-hex) — stored in gitignored `.env` AND set on the Railway
  app service `9f74a937...` via `railway variables --set`. (Value not recorded here; it's in
  `.env` + Railway. To rotate: `railway variables --set ADMIN_SECRET=<new> --service 9f74a937...`.)
- **`lib/drops.service.ts`** (plain TS, no Effect): `createDrop`, `addVariant`, `getDrop`,
  `listDrops`/`getDropWithVariants`, `transitionStatus` (with an ALLOWED_TRANSITIONS guard:
  coming_soon→open; open→closed/coming_soon; closed→settled/open; settled→open),
  `setSeed`, **`resetDrop`** (a transaction: delete orders for this drop's entries, delete
  entries, optionally re-open + reset countdown — scoped to ONE drop so seeded products survive),
  `flipComingSoon`, `insertDummyEntry`/`countEntries`, `findDropByName`, `deleteDrop`.
  Error classes `NotFoundError`/`InvalidTransitionError` map to 404/409 in the routes.
- **`lib/admin-auth.ts`**: `ADMIN_SECRET` gate via `x-admin-secret` header or `?secret=` query;
  fail-closed if unset; timing-safe-ish compare; `unauthorized()` → 401.
- **`lib/seed.ts`**: idempotent demo seed — deletes any existing Mac Mini/Mac Studio by name then
  creates **Mac Mini** (status `open`, `total_slots=1`, `price_usdc=10`, variants Silver/Black)
  + **Mac Studio** (status `coming_soon`, price 20, variants Silver/Black).
- **Routes:** `GET /api/drops` (public list). Admin (all gated):
  `POST /api/admin/seed`; `GET|POST /api/admin/drops`; `GET|DELETE /api/admin/drops/:id`;
  `POST /api/admin/drops/:id/:action` where action ∈ {open, close, settle, reset, flip, seed,
  add-variant, dummy-entry}. ⚠️ **Next 16: route `params` is a Promise — `await ctx.params`.**
- **`app/admin/page.tsx`**: minimal client operator console (enter secret → Load/Seed → per-drop
  buttons + a log). Utilitarian; pop-brutalist restyle is M9.
- **`scripts/m3-acceptance.ts`**: full-lifecycle + auth + flip test against a BASE_URL.

**Commit:** `066f852`.

**Acceptance test (literal output — run against the LIVE Railway URL):**
```
BASE_URL = https://worldcoinapp-production.up.railway.app
OK   GET /api/admin/drops without secret → 401
OK   POST /api/admin/seed → 200 ok
OK   seed created Mac Mini + Mac Studio
OK   Mac Mini present and open
OK   Mac Studio present and coming_soon
OK   Mac Mini has 2 variants
OK   POST /api/admin/drops (create) → 201
OK   transition coming_soon → open
OK   2 dummy entries inserted
OK   reset → status open
OK   reset truncated entries (got 0)
OK   invalid transition open → settled → 409
OK   flip Mac Studio coming_soon → open
OK   flip Mac Studio open → coming_soon
OK   DELETE throwaway drop → 200
M3_ACCEPTANCE: PASS
```
- Also PASS locally (standalone server). Live deployment `46d3a20c-66d1-4353-8b16-d84699d64206`
  **SUCCESS**. The two demo drops are now SEEDED in the live Railway DB (Mac Mini open, Mac Studio
  coming_soon) — ready for M4.

**Deviations from PRD:** none material. Added `DELETE /api/admin/drops/:id` (not in PRD) so the
test cleans up its throwaway drop. Used a single dispatch route `:id/:action` instead of separate
files per verb (simpler). Reset's countdown is set via `{ countdownSeconds }` body (defaults to
leaving closes_at untouched/null).

**NOTES FOR NEXT ITERATION (start M4 — World ID v4 verify + per-drop dedupe, WEB path):**
- This is the **core Sybil guarantee** on the web path. Target **v4** (NOT v3 `verifyCloudProof`).
  Verified env (RALPH_GUIDE §5 / PRD §0): app `app_1f62e669c5b6b7ec0b22ee9fcb295a0a`, RP
  `rp_8a9bfc2fcfa0ada9`, verify endpoint `POST https://developer.world.org/api/v4/verify/rp_8a9bfc2fcfa0ada9`.
- **Create a World ID v4 action per drop.** `actions_v4` is currently empty. Use the
  **`world-developer-portal` MCP** tool `create_world_id_action` (available this session). Store
  the created action id on the drop — there's already a **`drops.world_action_id`** column for it.
  Decide + record: one action per drop (`drop_<id>`) vs a dynamic-action pattern.
- Web widget: `@worldcoin/idkit` on the drop page (app id above, the drop's action, a signal).
  Backend verify route POSTs to the v4 endpoint; handle the v4 proof shape (5 hex elements;
  `nullifier` + `signal_hash`). `secret_keys` has `WORLD_APP_*` / `WORLD_MCP_API_KEY` /
  `WORLD_APP_SIGNER_KEY` — load what the endpoint needs; add them to `.env` + Railway service.
- On verify success: insert into `entries` with `human_key = nullifier`, `source='web'`,
  `nullifier_hash = <numeric>`. Rely on `UNIQUE(drop_id, human_key)` (proven in M2) to reject
  dupes; map the 23505 to a friendly "already entered". Build an entry service or extend
  `drops.service.ts`.
- Reusable: app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`,
  ADMIN_SECRET in `.env`+Railway. Demo drops already seeded live. Branch consider `build/m4-worldid`.
- ⚠️ Next 16 route handlers: `params` is a Promise (`await ctx.params`); DB client `@/lib/db` is a
  lazy proxy; build must pass with `env -u DATABASE_URL pnpm build` (no env-at-module-load).

---

## 2026-06-13 — iter-004 — M4 World ID v4 verify + per-drop nullifier dedupe (web path)
**Status of M4:** ACCEPTED

**Did:** (continued on branch `build/m3-admin-plane`)
- **Confirmed v4 ground truth** via `world-developer-portal` MCP `get_app_config`: app
  `app_1f62e669c5b6b7ec0b22ee9fcb295a0a` (cloud, active), RP `rp_8a9bfc2fcfa0ada9`
  (managed, registered), verify endpoint `POST https://developer.world.org/api/v4/verify/rp_8a9bfc2fcfa0ada9`.
  `actions_v4` was empty.
- **Created the per-drop World ID v4 actions** via MCP `create_world_id_action` (env=production):
  - Mac Mini → action string **`drop_c27f512e-af27-4963-88d3-a54bdab108a6`**
    (portal id `action_v4_30cb8edde5d8b96612721e6343d51bee`), `registration_status: registered`.
  - Mac Studio → action string **`drop_aafd0d75-d313-4aec-8b26-e558a6ffd9ba`**
    (portal id `action_v4_f401d33eb14532a1c3984b855fa80247`), registered.
  - **Naming scheme chosen: `drop_<full-uuid>`.** The *action string* (not the `action_v4_…` id)
    is what IDKit + the verify endpoint use; it's deterministic from the drop id, so a demo
    **reset keeps the same action** (no re-create needed). Stored on `drops.world_action_id`
    (backfilled via `scripts/backfill-actions.ts`).
- **Installed `@worldcoin/idkit@4.1.8`** (a real v4 package; pulls `@worldcoin/idkit-core@4.1.8`
  + `@worldcoin/idkit-server@1.1.1`). Authoritative API (read from the bundled `.d.ts`, NOT guessed):
  - `signRequest({ signingKeyHex, action, ttl })` → `{ sig, nonce, createdAt, expiresAt }`
    — exported from **`@worldcoin/idkit/signing`** (the bare `@worldcoin/idkit-server` is a
    non-hoisted transitive dep — import via the `/signing` subpath).
  - Widget: **`IDKitRequestWidget`** with props `{ open, onOpenChange, app_id, action,
    rp_context, allow_legacy_proofs, preset, onSuccess, onError }`; preset **`proofOfHuman({ signal })`**
    (v4 proof-of-human w/ legacy orb fallback). `onSuccess(result: IDKitResult)`.
  - v4 `IDKitResult` (uniqueness): `{ protocol_version:"4.0", nonce, action, responses:[{ identifier,
    nullifier, issuer_schema_id, expires_at_min, proof:[5 hex] }], ... }`. **No signal_hash
    computation / no payload reshaping in v4** — post the result verbatim to the verify endpoint.
- **`lib/worldid.service.ts`** (server-only): `mintRpContext(action, ttl=300)` (wraps `signRequest`),
  `verifyV4Proof(idkitResult)` → POSTs to the v4 endpoint (no auth header; `security:[]`), throws
  `WorldIdVerifyError` on `success!==true`; `nullifierFromResult()`. Reads `WORLD_APP_ID` /
  `WORLD_APP_RP_ID` / `WORLD_APP_SIGNER_KEY` from env (the signer key is the RP signing key).
- **`lib/entries.service.ts`**: `insertWebEntry({ dropId, nullifier, variantId, verificationLvl })`
  funnels through `UNIQUE(drop_id, human_key)` (humanKey=nullifier, source='web',
  nullifier_hash=decimal(hex)). `AlreadyEnteredError` on dupe. **`findWebEntry`, `countDropEntries`.**
- **Routes:** `POST /api/worldid/rp-context` (mint signed context for a drop's action; 409 if drop
  not open / no action); `POST /api/drops/:id/enter` (binds proof `action` to the drop → verify →
  dedupe; 201 first entry / 200 `{alreadyEntered:true}` / 422 bad proof).
- **Web UI:** `/drops/[id]` entry page (server component: drop + variant chips + fairness count) →
  `components/drop-entry-panel.tsx` (variant state) → `components/world-id-entry.tsx` (the IDKit v4
  flow: fetch rp-context → open widget → POST result). Landing page now lists drops as cards.
- **Env:** added `WORLD_APP_ID`, `WORLD_APP_RP_ID`, `WORLD_APP_SIGNER_KEY`, `NEXT_PUBLIC_WORLD_APP_ID`
  to gitignored `.env` AND to the Railway app service `9f74a937…` (set, then deployed). Values live
  in `secret_keys` / Railway — not recorded here.

**Commit:** `e322502` (M4 full slice). Deployed: `railway up --ci --service 9f74a937…` → "Deploy complete" (exit 0).

**Acceptance test (literal output):**
- **Live wiring** (`https://worldcoinapp-production.up.railway.app`):
  - `/api/health` → `{"ok":true}`, `/api/health/db` → `{"db":"ok"}`.
  - `POST /api/worldid/rp-context {dropId: MacMini}` → `app_id=app_1f62…`, `action=drop_c27f512e…`,
    `rp_id=rp_8a9bfc2fcfa0ada9`, signature len 132, ttl 300.
  - `POST /api/worldid/rp-context {dropId: MacStudio(coming_soon)}` → **HTTP 409** (only open drops).
  - `POST /api/drops/<MacMini>/enter` with a **bogus proof** → **HTTP 422**
    `{"error":"World ID verification failed","detail":"All proof verifications failed."}`
    ⇒ proves the live v4 RP endpoint is integrated and actually verifying (not stubbed).
- **Dedupe invariant** (`pnpm exec tsx scripts/m4-acceptance.ts`, against live Railway Postgres):
  ```
  OK   Mac Mini has a World ID action (drop_c27f512e-af27-4963-88d3-a54bdab108a6)
  OK   Mac Studio has a World ID action (drop_aafd0d75-d313-4aec-8b26-e558a6ffd9ba)
  OK   rp_context.rp_id == rp_8a9bfc2fcfa0ada9 / nonce 32-byte / ttl 300 / signature present
  OK   1) nullifier N → Mac Mini: inserted (one slot taken); human_key==nullifier; source=web; nullifier_hash==decimal(N)
  OK   2) nullifier N → Mac Mini (replay): AlreadyEnteredError; no second row created
  OK   3) nullifier N → Mac Studio (different drop): inserted (cross-drop action scoping OK)
  OK   one entry per drop for this human (Mac Mini + Mac Studio); cleanup removed synthetic entries
  M4_ACCEPTANCE: PASS (0 failures)
  ```

**Deviations from PRD:**
- ‼️ **A real World App proof cannot be produced headlessly** — PRD M4 Verification explicitly
  allows this ("document the manual step + provide a scripted path"). So M4 is proven in two
  halves, each against the REAL production code: (a) the verify→live-RP wiring is exercised live
  (422 on an invalid proof; the endpoint is real and reachable, rp_context is correctly signed),
  and (b) the dedupe invariant — what a valid proof feeds into — is driven through the exact
  production `insertWebEntry()` funnel by `scripts/m4-acceptance.ts`. The only step a human does
  live is hold a phone + verify in World App (that's the M9/M10 demo itself).
- ‼️ **Unique-violation detection bug found & fixed.** Drizzle wraps the postgres.js error in
  `DrizzleQueryError`; SQLSTATE `23505` is on **`err.cause.code`**, NOT `err.code` (the M2 script
  saw `.code` only because it used the raw `sql` client). `isUniqueViolation` now checks both.
  Without this the `/enter` "already entered" path would 500 instead of returning 200. (Captured.)
- Action provisioning is **out-of-band via MCP** (done for the 2 demo drops). A brand-new drop
  created through the admin API would need its v4 action created via the MCP `create_world_id_action`
  before web entry works (resets are fine — same action). Acceptable for the demo; M7+ can add a
  server-side self-provision if needed.

**NOTES FOR NEXT ITERATION (start M5 — USDC settlement on World Chain Sepolia, viem):**
- Add **`viem`**. Chain object: World Chain **Sepolia, id `4801`** (NOT 480), RPC
  `https://worldchain-sepolia.g.alchemy.com/public`, explorer `https://sepolia.worldscan.org`.
- **USDC `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88`**, 6 decimals, `$10 = 10000000` raw. Bridged USDC.e.
- `lib/settlement.service.ts`: ERC-20 `transfer`, sign with a wallet PK from the resource files —
  **`demo_wallets.md`** has Agent 1 / Agent 2 / Human (addr + PK + faucet checklist); `secret_keys`
  has the Agent Wallet (`0x49Eb10a0f136f02A09E5D0702eF0f94521873613`). Wait for receipt; write
  `orders.tx_hash` + status. The `orders` table already exists (entry_id FK, amount_usdc numeric(20,6)).
- Guarded admin route `/api/admin/test-transfer` (use `isAuthorized` from `lib/admin-auth.ts`) +
  a balance read endpoint. Pre-flight USDC + native ETH balances; clear "fund via faucet" error if dry.
- **Acceptance:** a real 10-USDC transfer between two funded demo wallets confirms on chain 4801 and
  is recorded in `orders`. If faucets are dry → this is the one OK place to BLOCK (write `## BLOCKED`).
- Reusable: app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`,
  ADMIN_SECRET + WORLD_* in `.env`+Railway. Drops seeded live (Mac Mini open, Mac Studio coming_soon)
  with their `world_action_id` set. Redeploy: `railway up --ci --service 9f74a937… -m "<msg>"`.
- ⚠️ Drizzle unique/constraint errors live on `err.cause.code` (see M4 fix) — reuse that pattern.
- ⚠️ Still on branch `build/m3-admin-plane` (nothing merged to main yet). Fine to continue here or
  branch `build/m5-settlement` off it.
