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
- **M5 — USDC settlement (viem, chain 4801):** ACCEPTED
- **M6 — Fair draw engine + winner purchase window:** ACCEPTED
- **M7 — MCP server: info + entry tools (AgentKit auth):** ACCEPTED
- **M8 — MCP purchase tool + e2e agent settlement:** ACCEPTED
- **M9 — Web purchase UI + pop-brutalist design pass:** ACCEPTED
- **M10 — Demo hardening + reset choreography + dry run:** ACCEPTED
- **🎉 ORIGINAL SCOPE COMPLETE — all M0–M10 accepted; Definition of Done met.**
- **M11 — Real time-driven lifecycle (autonomous open + draw):** ACCEPTED
- **M12 — Timer UI + SOLD OUT + winner page:** ACCEPTED
- **M13 — Live demo tooling + runbook (1:30 / 2h launch + practice harness):** ACCEPTED
- **🏁 PROJECT COMPLETE — all M0–M13 accepted; full Definition of Done (incl. M11–M13) met.**

> **Extension milestones added 2026-06-14** (see `PRD.md` §3b). Real, time-driven timers — no
> smoke and mirrors: set a drop to launch in 1:30 and the server opens + draws on its own clock;
> the 2h NVIDIA raffle really fires if you wait. World ID scan + agent calls stay LIVE (done by a
> human in the demo). **All M0–M13 are ACCEPTED — the project is done.**
> Build order was strict: M10 → M11 → M12 → M13.

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

---

## 2026-06-13 — iter-004 (cont.) — M5 USDC settlement on World Chain Sepolia (viem, chain 4801)
**Status of M5:** ACCEPTED

**Did:** (same branch `build/m3-admin-plane`, continued after M4)
- **Installed `viem@2.52.2`.** viem ships a built-in **`worldchainSepolia`** chain (id `4801`) —
  used it, RPC overridden to `WORLD_CHAIN_SEPOLIA_RPC` (`https://worldchain-sepolia.g.alchemy.com/public`).
- **`lib/chain.ts`**: `publicClient()` / `walletClientFromKey(pk)`, `USDC_ADDRESS`
  `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` (6 dec), `EXPLORER` `https://sepolia.worldscan.org`,
  `explorerTxUrl()`, minimal ERC-20 ABI (balanceOf/transfer/decimals).
- **`lib/settlement.service.ts`**: `transferUsdc({ privateKey, to, amount, entryId?, recordOrder? })`
  — pre-flights USDC + native ETH (throws `InsufficientFundsError` with the faucet links if dry),
  sends ERC-20 `transfer`, **waits for the receipt**, writes an `orders` row (tx_hash, from/to,
  status confirmed|failed). `getBalances(addr, blockNumber?)` (block-pinned reads avoid the public
  RPC read-after-write race). `toUsdcRaw("10")` → `10_000_000n`.
- **`lib/wallets.ts`**: resolves demo wallets by NAME (`agent1`|`agent2`|`human`|`agent`) →
  `{ address, privateKey }` from env. Keys never cross the client; routes pass names only.
- **Schema/migration `0001_gorgeous_the_hand.sql`**: `orders.entry_id` made **nullable** (so a
  standalone settlement can be recorded before M6 wires it to a winning entry) + added
  `orders.from_address` / `orders.to_address`. Applied via `pnpm db:migrate`.
- **Routes (auth-gated via `lib/admin-auth.ts`):**
  - `GET /api/admin/balances` — USDC+ETH for all demo wallets, or `?address=0x…`.
  - `POST /api/admin/test-transfer` — `{ from?, to?, amount? }` (defaults agent1→agent2, 1 USDC);
    `InsufficientFundsError` → **402**.
- **`scripts/m5-acceptance.ts`** + **`scripts/check-balances.ts`**.

**Commit:** `5c3ab0b`. Deployed: `railway up --ci --service 9f74a937…` → "Deploy complete" (exit 0).

**Funding (verified on-chain at start of M5):** Agent 1 / Agent 2 / Human each had **0.01 ETH +
20 USDC**; the secret_keys Agent Wallet (`0x49Eb…3613`) has 20 USDC but **0 ETH** (can't pay gas —
use the demo wallets for transfers). Faucets did NOT need a human — no BLOCK.

**Acceptance test (literal — real on-chain txs on chain 4801, all `status: confirmed`):**
- `pnpm exec tsx scripts/m5-acceptance.ts` (real 10 USDC agent1→agent2) → **M5_ACCEPTANCE: PASS (0 failures)**:
  - tx `0xa87870cf92535582d1429a1979e3af68ca0b1218d14bdadc5a15a5310e121ec2`
    (explorer: https://sepolia.worldscan.org/tx/0xa87870cf92535582d1429a1979e3af68ca0b1218d14bdadc5a15a5310e121ec2)
  - asserts: receipt success · valid 32-byte hash · amount 10 · `orders` row (tx_hash/status=confirmed/
    amount_usdc=10.000000/from/to) · **sender −10, recipient +10 USDC** (delta read at the mined block).
  - (An earlier identical run produced confirmed tx `0x98a7636dea1814845f7124589e31caf9feccc267995bf1fa78542d422f4fbf19`;
    its only "failures" were a balance read-after-write race, since fixed with block-pinned reads.)
- **Live money path through the Railway app:** `POST /api/admin/test-transfer {from:human,to:agent1,amount:1}`
  → `{"ok":true,"status":"confirmed","txHash":"0x2be63793b4847274eea2f7ff387da9d448b453e88742ac0b60e4368e28f60d49","orderId":"3a6c412a-…"}`
  (explorer: https://sepolia.worldscan.org/tx/0x2be63793b4847274eea2f7ff387da9d448b453e88742ac0b60e4368e28f60d49).
  Auth: `/api/admin/balances` and `/api/admin/test-transfer` both **401 without the secret**.
- Live `GET /api/admin/balances` (chainId 4801) after the demo txs: agent1 **0** USDC, agent2 **40**,
  human **19** (each still ~0.01 ETH).

**Deviations from PRD:** `orders.entry_id` made nullable (PRD didn't specify) so the standalone
test-transfer can record an order without a winning entry — M6 will set `entry_id` for real purchases.
Added `from_address`/`to_address` to `orders` for the audit/demo (not in the original schema).

**⚠️ WALLET BALANCES NOW (post-M5, important for M6/M8):** agent1 **0 USDC**, agent2 **40 USDC**,
human **19 USDC**; all ~0.009–0.01 ETH. **For M6/M8 the WINNER must have ≥ price (10 USDC) to buy.**
If you seed the draw so a specific wallet wins, make sure THAT wallet is funded — agent1 is currently
dry. Either re-fund agent1 (faucets: https://faucet.circle.com Worldchain Sepolia ~20 USDC/2h;
gas https://www.alchemy.com/faucets/world-chain-sepolia) or seed the win to agent2/human (funded).

**NOTES FOR NEXT ITERATION (start M6 — Fair draw engine + winner→purchase window):**
- `lib/draw.service.ts`: at `closes_at` (or admin **force-draw**), pick `total_slots` winners
  **uniformly at random** from `entries` where `status='pending'` for the drop → mark `won`, rest `lost`.
- **Seedable RNG**: the drop's `draw_seed` (already on `drops`, set via `/api/admin/drops/:id/seed`)
  makes the winner deterministic for staged demos; no seed → real CSPRNG (`node:crypto`). Use a
  seeded PRNG (e.g. hash the seed + entry ids → sort) so the SAME seed + SAME entry set → SAME winner.
- **Winner purchase window**: a `won` entry can `purchase` within a bounded window → calls
  **`transferUsdc` (M5)** for `price_usdc` from the winner's wallet to a merchant/receiver → set
  `orders.entry_id` + entry `purchased`; expired window → `expired`. Non-winners blocked.
- Wire admin **force-draw** (`/api/admin/drops/:id/draw` or add to the `:id/:action` dispatch) to run
  the draw immediately (no real countdown wait in the demo).
- **Reusable money path:** `transferUsdc({ privateKey, to, amount, entryId })` from
  `lib/settlement.service.ts`; resolve the winner's wallet via `lib/wallets.ts` (`getWallet(name)`).
  Map web entries → a wallet for the demo (e.g. the "human" demo wallet). Record which wallet maps to
  the seeded winner. Chain client in `lib/chain.ts`.
- **Acceptance:** fixed seed + known entry set → exact expected winner every run; that winner completes
  a real USDC purchase on 4801 (ends `purchased`); non-winners cannot purchase.
- Reusable IDs unchanged: app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`.
  Env on Railway now also has WORLD_CHAIN_SEPOLIA_RPC + DEMO_{AGENT1,AGENT2,HUMAN}_{PK,ADDRESS}.
  Redeploy: `railway up --ci --service 9f74a937… -m "<msg>"`. ⚠️ Avoid `0n` bigint literals
  (tsconfig target ES2017) — use `BigInt(0)`.

---

## 2026-06-13 — iter-005 — M6 Fair draw engine + winner → purchase window
**Status of M6:** ACCEPTED

**Did:** (same branch `build/m3-admin-plane`, continued after M5)
- **`lib/draw.service.ts`** (plain TS): `runDraw(dropId, {windowSeconds?, force?})` — selects
  `total_slots` winners from `pending` entries, marks them `won` (with a bounded
  `purchase_deadline`) and the rest `lost`, stamps `drops.drawn_at`, and (if the drop was
  `open`) flips it to `closed`. **Seedable RNG = deterministic:** if `drops.draw_seed` is set,
  the per-entry rank key is `SHA-256(seed + ":" + entryId)` hex; sort ascending, take the first
  N → the SAME seed + SAME entry set ALWAYS yields the SAME winner. No seed → `node:crypto`
  `randomBytes(32)` per entry (independent draws). `purchaseForEntry({entryId, privateKey,
  receiverAddress})` — real M5 USDC `price_usdc` transfer winner→receiver, then entry →
  `purchased` + `orders.entry_id` linked. Guards: `NotAWinnerError` (lost/pending/expired),
  `WindowExpiredError` (past deadline → marks `expired`), `AlreadyPurchasedError`,
  `InsufficientFundsError` (from M5, → 402). `getDrawState(dropId)` groups entries by status.
- **Schema (migration `0002_open_quasimodo.sql`, additive):** `drops.receiver_address` (merchant
  paid by the winner; null → env `RECEIVER_ADDRESS`/agent1 default) + `drops.drawn_at`;
  `entries.wallet_address` (which wallet a winning entry settles FROM) + `entries.purchase_deadline`.
  Applied via `pnpm db:migrate`.
- **`lib/wallets.ts`:** `getWalletByAddress(addr)` (maps a stored entry wallet_address back to its
  keypair so the server signs without the key ever crossing the wire) + `getReceiverAddress()`
  (env `RECEIVER_ADDRESS`/`MERCHANT_ADDRESS`, else agent1).
- **`lib/drops.service.ts`:** added `setReceiver(dropId, addr|null)`; `insertDummyEntry` now takes
  an optional `walletAddress` and RETURNS the new entry id (was void); `resetDrop` now also clears
  `drawn_at`. **`lib/entries.service.ts`:** `insertWebEntry` accepts optional `walletAddress`.
- **Routes:** admin `:id/:action` dispatch gained **`draw`** (`{windowSeconds?}` → winners/losers
  + state) and **`set-receiver`** (`{receiverAddress}`); `dummy-entry` now accepts `walletAddress`
  and returns `entryId`. New **`POST /api/drops/:id/purchase`** (`{entryId, wallet?}`): resolves the
  signer server-side from the entry's `wallet_address` (or a `wallet` name), settles to the drop's
  receiver. Status codes: 200 ok / 402 insufficient funds / 403 not-a-winner / 409 expired|already
  / 404 not-found.
- **`scripts/m6-acceptance.ts`** (self-cleaning throwaway drop): proves determinism (independent
  SHA-256 prediction == runDraw winner, same across re-draws), winner count, real purchase, and
  non-winner/double-purchase blocks.

**Commit:** `52118fa`. Deployed: `railway up --ci --service 9f74a937…` → "Deploy complete";
newest deployment **`55b516c3-5228-4942-8aa2-3b512598fcac` SUCCESS**.

**Acceptance test (literal output):**
- `pnpm exec tsx scripts/m6-acceptance.ts` → **M6_ACCEPTANCE: PASS (0 failures)**:
  ```
  OK   5 candidate entries seeded
  OK   draw produced exactly total_slots (1) winner
  OK   the other 4 entries are losers
  OK   draw winner == independently-predicted seeded winner
  OK   re-draw with same seed → SAME winner (true)
  OK   winner entry status == 'won' / a non-winner entry status == 'lost'
  OK   a LOST entry cannot purchase (NotAWinnerError)
  OK   purchase tx hash valid · amount == 10 USDC · status 'purchased' · entry → 'purchased'
  OK   orders row: entry_id linked · status confirmed · amount 10.000000 · to == receiver
  OK   re-purchasing the same winner is rejected (AlreadyPurchasedError)
  OK   throwaway drop deleted (cascade)
  ```
  Real tx (local run, human→agent1, 10 USDC, confirmed):
  `0xcb7c55f3948ace7678c2b46696695e151ab844c6522298b40eac4dd35a6dd72a`
  (https://sepolia.worldscan.org/tx/0xcb7c55f3948ace7678c2b46696695e151ab844c6522298b40eac4dd35a6dd72a)
- **LIVE HTTP path** (full draw→purchase through the Railway app, throwaway drop created+deleted):
  - seed 3 entries → `POST :id/draw` → 1 winner / 2 losers, drop → `closed`.
  - loser `POST /api/drops/:id/purchase` → **403** `"... is 'lost', not a winner"`.
  - winner (wallet=agent2, funded) `POST /api/drops/:id/purchase` → **HTTP 200**, real tx
    `0xd2cee25f030e1a85cb91047d20f93dcc8f4608b9ec3e6486b2b2a66010de1a5a` (10 USDC agent2→human,
    confirmed; orderId `68c770ed-…`), entry → `purchased`.
  - re-purchase winner → **409** `"already purchased"`. `DELETE` throwaway drop → 200; GET → 404.
  - (also proved the pre-flight: a winner mapped to a dry wallet → **402** with the faucet link.)
  - Seeded demo drops survived: `GET /api/drops` → Mac Mini open (2 var), Mac Studio coming_soon (2 var).

**Deviations from PRD:** none material.
- Added `entries.wallet_address` so a winning entry knows which wallet settles for it (PRD left
  the web entry→wallet mapping to "pick the simplest convincing path"; storing the address at
  entry/seed time and resolving the key server-side via `getWalletByAddress` is that path — keys
  never leave the server). Web `insertWebEntry` can pass a wallet (M9 will map the human demo wallet).
- Added `drops.receiver_address` + `set-receiver` action (merchant target) and `drops.drawn_at`
  (audit). The draw also auto-`closes` an `open` drop (lifecycle convenience; reset re-opens it).
- Purchase window default = **600s** (`DEFAULT_PURCHASE_WINDOW_SECONDS`). A null deadline is
  treated as "open" (demo safety). Expired → entry flips to `expired` then rejects.

**⚠️ WALLET BALANCES NOW (post-M6 — important for M7/M8):** the two live M6 txs were a wash on the
human wallet (−10 local acceptance, +10 live receiver), and agent2 −10 live. Re-check before M8 with
`pnpm exec tsx scripts/check-balances.ts`. Rough state: **agent1 ~1 USDC (RECEIVER default — keep
funded enough only if it must SEND), agent2 ~30 USDC, human ~19 USDC**; all ~0.009–0.01 ETH gas.
For M8 the WINNING AGENT wallet must have ≥10 USDC + gas. Seed the win to a funded wallet (agent2)
or refund: USDC https://faucet.circle.com (Worldchain Sepolia, ~20/2h), gas
https://www.alchemy.com/faucets/world-chain-sepolia.

**NOTES FOR NEXT ITERATION (start M7 — MCP server: info + entry tools, AgentKit auth):**
- Stand up a remote MCP server with **`@modelcontextprotocol/sdk`** over **streamable-HTTP** so
  Claude/ChatGPT can add it as a custom connector. Mount it as a Next route handler (e.g.
  `app/api/mcp/route.ts`) — simplest given everything else is in this app — OR a sibling process;
  record which. ⚠️ **Read `node_modules/next/dist/docs/` for route-handler specifics** (modified Next).
- **AgentKit auth = Option A (native per-request signature), NOT a delegated bearer token (doesn't
  exist).** On each privileged tool call expect the AgentKit x402-style signed CAIP-122 header →
  `verifyAgentkitSignature()` to recover the wallet → `createAgentBookVerifier()` to resolve
  wallet → anonymous `humanId` on World Chain. Reject unsigned calls with a **402 challenge**.
  Optional Option-B cache: a `sessions` row (token→humanId, table already exists) — cache ONLY,
  never the source of truth. **Confirm the exact AgentKit package name at install** (may have moved;
  RALPH_GUIDE §6 says verify — record the real name + version in PROGRESS).
- **Tools:** `list_drops`, `get_drop_info(drop_id)` (the coming-soon informational tool),
  `enter_draw(drop_id, variant)` (insert entry with `human_key = humanId`, **`source='agent'`** —
  reuse the `entries` funnel; add an `insertAgentEntry` to `lib/entries.service.ts` mirroring
  `insertWebEntry` but keyed on humanId + set `entries.human_id`), `check_status(drop_id)`.
- The per-drop **UNIQUE(drop_id, human_key)** must gate agent entries too (humanId is the key).
  Cross-surface caveat: World ID nullifier (web) and AgentBook humanId (agent) are different
  namespaces → dedupe holds WITHIN each surface; document the honest caveat (PRD M7 step 4).
- **M6 building blocks to reuse for M8:** `runDraw` is seedable (`drops.draw_seed`, set via
  `/api/admin/drops/:id/seed`), force via `/api/admin/drops/:id/draw`; the agent purchase tool
  (M8) calls **`purchaseForEntry`** from `lib/draw.service.ts` with the AGENT's wallet. Set the
  entry's `wallet_address` to the agent wallet at `enter_draw` time so purchase resolves the signer
  (or pass it explicitly). Receiver via drop `receiver_address` / `set-receiver` / env default.
- Reusable IDs unchanged: app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`,
  ADMIN_SECRET + WORLD_* + DEMO_* + WORLD_CHAIN_SEPOLIA_RPC in `.env`+Railway. Demo drops seeded
  live with `world_action_id`. Redeploy: `railway up --ci --service 9f74a937… -m "<msg>"`.
- ⚠️ Carryover gotchas: Next 16 route `params` is a Promise (`await ctx.params`); `@/lib/db` is a
  lazy proxy; build must pass `env -u DATABASE_URL pnpm build`; Drizzle unique errors live on
  `err.cause.code`; tsconfig target ES2017 → use `BigInt(0)` not `0n`; Railway Metal builder
  rejects `# syntax=` / BuildKit cache mounts in the Dockerfile.
- ⚠️ Still on branch `build/m3-admin-plane` (nothing merged to main). Fine to continue or branch
  `build/m7-mcp` off it.

---

## 2026-06-13 — iter-006 — M7 MCP server: info + entry tools (AgentKit per-request auth)
**Status of M7:** ACCEPTED

**Did:** (same branch `build/m3-admin-plane`, continued after M6)
- **Confirmed the REAL package names + APIs** (PRD said to verify): **`@worldcoin/agentkit@0.2.0`**
  re-exports **`@worldcoin/agentkit-core@0.2.0`**, which has the exact Option-A primitives the
  PRD references: `parseAgentkitHeader`, `validateAgentkitMessage`, `verifyAgentkitSignature`,
  `createAgentBookVerifier`, `formatSIWEMessage`, `AgentkitPayloadSchema`. (No
  `verifyAgentkitSignature` lived on the top-level `@worldcoin/agentkit` — it's in `-core`,
  which `agentkit` re-exports via `export *`. Import from either.) MCP: **`@modelcontextprotocol/sdk@1.29.0`**.
  Added `zod@4.4.3` (SDK peer; resolved automatically). Commit `99b1657`.
- **`lib/agentkit-auth.ts` (server, Option A)** — per-request AgentKit auth pipeline:
  1) `parseAgentkitHeader(header)` (base64(JSON) → SIWE-shaped `AgentkitPayload`),
  2) `validateAgentkitMessage(payload, resourceUri)` — binds the signed message to THIS server's
     domain/uri + freshness (replay window),
  3) `verifyAgentkitSignature(payload, rpcUrl)` — EIP-191/ERC-1271 verify, recovers the wallet
     (uses `WORLD_CHAIN_SEPOLIA_RPC`; falls back to public Alchemy),
  4) `createAgentBookVerifier().lookupHuman(address)` → anonymous `humanId` on World Chain.
  Throws `AgentkitAuthError` (→ 402 challenge) on missing/invalid sig. **Header:** `x-agentkit-payload`
  (aliases `x-agentkit`/`agentkit-payload`/`x-payment`). `resourceUriFromRequest` honors Railway's
  `x-forwarded-proto`/`x-forwarded-host` so the signed domain matches the public URL.
- **`lib/agentkit-client.ts` (client signer)** — what an agent does before a privileged call:
  build the SIWE message with `formatSIWEMessage`, sign EIP-191, emit the base64 header. Used by
  the test harness + reused by M8. ‼️ **Protocol gotcha (cost me a debug cycle):**
  `validateAgentkitMessage` requires **`payload.domain` = URL hostname (NO port)** while
  **`payload.uri` = full origin (WITH port)**. Splitting them wrong → "Domain mismatch". Encoded
  this split in the client builder; documented in both files.
- **`app/api/mcp/route.ts`** — remote MCP server mounted as a Next route handler using the SDK's
  **`WebStandardStreamableHTTPServerTransport`** (speaks Web `Request`/`Response` — no Node req/res
  adapter; perfect for App-Router handlers). **STATELESS** (`sessionIdGenerator: undefined`,
  `enableJsonResponse: true`): each POST builds a fresh `McpServer`+transport, connects, handles one
  request, tears down → auth is purely per-request (Option A, no server session as source of truth).
  `runtime = "nodejs"` (agentkit-core uses siwe/viem/node-crypto, not edge-safe). Tools close over
  the live `Request` so privileged tools read the AgentKit header off the actual request.
  **Tools:** `list_drops`, `get_drop_info(drop_id)` (both public/informational; get_drop_info also
  returns YOUR status if signed), `enter_draw(drop_id, variant?)` (PRIVILEGED), `check_status(drop_id)`
  (PRIVILEGED). Tools return text + embedded JSON; `isError:true` on failures.
- **`lib/entries.service.ts`:** added **`insertAgentEntry`** (mirrors `insertWebEntry` but
  `human_key = humanId`, `source='agent'`, sets `human_id` col, stores the agent `wallet_address`
  for M8 purchase) + **`findEntryByHumanKey`**. Both funnel through the SAME
  `UNIQUE(drop_id, human_key)` → the Sybil guarantee now gates the agent surface too.
- **Tests:** `scripts/m7-acceptance.ts` (MCP-client journey) + `scripts/m7-neg-tamper.ts`
  (tampered-signature rejection).

**Commit:** `99b1657` (M7 full slice). Deployed: `railway up --ci --service 9f74a937…` →
"Deploy complete"; newest deployment **`f4f72e3c-16a4-4fbf-85c0-2a182e4e8b86` SUCCESS**.

**Acceptance test (literal output — run against the LIVE Railway URL):**
```
MCP_URL = https://worldcoinapp-production.up.railway.app/api/mcp
OK   MCP advertises the 4 tools (got: check_status, enter_draw, get_drop_info, list_drops)
OK   list_drops returned 2 drop(s)
OK   Mac Mini present and open
OK   Mac Studio present and coming_soon
OK   get_drop_info(Mac Studio) → coming_soon, 2 variant(s)
OK   unsigned enter_draw → rejected with 402-style challenge
agent1 wallet = 0x8BAf91Af9682b5Cc0d69DBE7152f962558D754a7
OK   agent1 enter_draw(Mac Mini) → entered
OK   entry recorded source='agent' with entry_id
OK   agent1 resolved a humanId (agentkit:0x8BAf91Af9682b5Cc0d69DBE7152f962558D754a7)
OK   agent1 second enter_draw → already_entered (Sybil block), no second slot
OK   fresh signature has a different nonce (distinct header)
OK   same wallet, NEW signature → still already_entered (humanId dedupe, not nonce-bound)
OK   check_status(agent1) → entered=true, status='pending'
OK   different wallet (humanId agentkit:0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC) can enter Mac Mini
OK   the two agents resolved to DISTINCT humanIds (per-wallet identity)
M7_ACCEPTANCE: PASS (0 failures)
```
- Also PASS locally (dev server) BEFORE deploy. Tampered-sig negative test:
  `tampered-sig isError = true | rejected as invalid sig: true` ⇒ verification is genuinely
  enforced, not header-presence. After the live test I **reset Mac Mini** (cleared the synthetic
  agent entries) — live demo state pristine again: Mac Mini open (2 var, 0 entries), Mac Studio
  coming_soon (2 var).

**Deviations from PRD:**
- ‼️ **AgentBook registration is a real World-App-gated flow we can't do headlessly for the demo
  wallets** (PRD M7 step 4 + M8 step 2 anticipate this). `createAgentBookVerifier().lookupHuman`
  queries the canonical AgentBook on **World Chain MAINNET (480)** and returns `null` for our
  unregistered demo wallets. **Resolution:** the SIGNATURE VERIFICATION (the actual AgentKit
  security primitive — proving the wallet authorized the request) is genuinely enforced on every
  privileged call; for the humanId we fall back to a deterministic **wallet-scoped** id
  `agentkit:<checksummed-address>` (namespaced so it can NEVER collide with a web nullifier). One
  wallet ⇒ one humanId ⇒ one slot per drop — the dedupe holds. If a wallet IS AgentBook-registered,
  the real on-chain humanId wins (`agentBookResolved: true`). **Cross-surface honest caveat:** web
  nullifiers (World ID) and agent humanIds (AgentBook/fallback) are different namespaces, so dedupe
  is per-surface — exactly as PRD M7 step 4 says to document.
- Stateless MCP (no session table) chosen over Option-B `sessions` cache — per-request signing is
  cheap and is the cleanest expression of Option A. The `sessions` table stays available if M8 wants
  an ergonomic cache, but it's NOT the source of truth.
- `get_drop_info` opportunistically includes the caller's own entry status when a valid signature is
  present (never *requires* it) — small UX nicety, not in the PRD's tool list verbatim.

**NOTES FOR NEXT ITERATION (start M8 — MCP purchase tool + e2e agent settlement):**
- Add a **`purchase(drop_id)`** MCP tool to `app/api/mcp/route.ts`: AgentKit-auth → find THIS human's
  entry for the drop (`findEntryByHumanKey(dropId, identity.humanId)`) → it must be `won` within its
  window → call **`purchaseForEntry`** from `lib/draw.service.ts` with the AGENT'S wallet key. The
  agent's `wallet_address` is ALREADY stored on the entry at `enter_draw` time (I set it), so resolve
  the signer via **`getWalletByAddress(entry.walletAddress)`** (keys never leave the server). Return
  tx hash + `explorerTxUrl`. Reject non-winners (NotAWinnerError → tool isError), expired window.
- **Full agent journey for the M8 acceptance:** via MCP only — `enter_draw` → (admin **force-draw**
  seeded to this agent: set `drop.draw_seed` via `/api/admin/drops/:id/seed`, then
  `/api/admin/drops/:id/draw`) → `purchase` → real USDC tx on 4801 → entry `purchased`. The seeded
  RNG is `SHA-256(seed + ":" + entryId)` ascending; to make a SPECIFIC agent win with `total_slots=1`,
  either seed so its entry sorts first OR (simpler for the demo) make it the ONLY entrant. Reuse the
  M6 prediction logic from `scripts/m6-acceptance.ts`.
- ‼️ **WALLET FUNDING:** the winning agent wallet must hold **≥ price (10 USDC) + gas**. Re-check with
  `pnpm exec tsx scripts/check-balances.ts` before the run. Post-M6 rough state: agent1 ~1 USDC (it's
  the default RECEIVER), agent2 ~30 USDC, human ~19 USDC; all ~0.009–0.01 ETH. **Seed the win to a
  funded wallet (agent2)** or refund: USDC https://faucet.circle.com (Worldchain Sepolia ~20/2h), gas
  https://www.alchemy.com/faucets/world-chain-sepolia. NOTE the agent wallet that ENTERS is the one
  that PAYS — pass `DEMO_AGENT2_PK` to `buildAgentkitHeader` so entry.wallet_address = agent2.
- **Reusable client signer:** `buildAgentkitHeader({ privateKey, resourceUri })` from
  `lib/agentkit-client.ts` (domain/uri split handled). The MCP client transport carries it via
  `requestInit.headers['x-agentkit-payload']` (see `scripts/m7-acceptance.ts` for the exact pattern).
- **Confirmed env on Railway app service** already has `WORLD_CHAIN_SEPOLIA_RPC` + `DEMO_*` keys.
  Added NOTHING new for M7 (no new env vars needed — auth RPC falls back to public Alchemy). Optional:
  set `AGENTBOOK_RPC_URL` (World Chain mainnet) if you want real AgentBook lookups to resolve.
- Reusable IDs unchanged: app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`,
  **MCP endpoint `…/api/mcp`** (streamable-HTTP, stateless). Mac Mini drop id
  `c27f512e-af27-4963-88d3-a54bdab108a6` (action `drop_c27f512e-…`); Mac Studio
  `aafd0d75-d313-4aec-8b26-e558a6ffd9ba`. Redeploy: `railway up --ci --service 9f74a937… -m "<msg>"`.
- ⚠️ Carryover gotchas (unchanged): Next 16 route `params` is a Promise (`await ctx.params`);
  `@/lib/db` is a lazy proxy; build must pass `env -u DATABASE_URL pnpm build`; Drizzle unique errors
  on `err.cause.code`; tsconfig ES2017 → `BigInt(0)` not `0n`; Railway Metal builder rejects
  `# syntax=` / BuildKit cache mounts; **tsx scripts need an async `main()` — top-level await fails
  esbuild's CJS transform.** Still on branch `build/m3-admin-plane` (nothing merged to main).

---

## 2026-06-13 — iter-006 (cont.) — M8 MCP purchase tool + end-to-end agent settlement
**Status of M8:** ACCEPTED

**Did:** (same branch `build/m3-admin-plane`, continued after M7)
- **Added a privileged `purchase(drop_id)` MCP tool** to `app/api/mcp/route.ts`:
  1) AgentKit per-request auth → verified wallet + humanId (reuses M7 `authenticateAgent`),
  2) `findEntryByHumanKey(drop_id, identity.humanId)` → THIS human's entry,
  3) resolve the signer **server-side** from the entry's stored `wallet_address` (set at
     `enter_draw` time = the agent's verified wallet) via `getWalletByAddress` — keys never cross
     the wire; falls back to the freshly-verified caller wallet,
  4) **defense in depth:** the verified caller wallet must OWN the entry's wallet (a signature from
     a different wallet can't drive someone else's purchase),
  5) `purchaseForEntry` (M6→M5): real USDC `price_usdc` transfer winner→receiver on chain 4801,
     entry → `purchased`, `orders` row linked. Returns tx hash + `explorer_url`.
  Rejects: not-a-winner (`NotAWinnerError`), expired window, already-purchased, insufficient funds
  — each as a tool `isError` with a clear message. Imports added: `purchaseForEntry` + error classes
  from `draw.service`, `getWalletByAddress`/`getReceiverAddress` from `wallets`, `InsufficientFundsError`.
- **`scripts/m8-acceptance.ts`** — full MCP-ONLY agent journey on **throwaway drops** (created +
  deleted via admin, so the seeded demo state is untouched):
  - **Drop A (win+buy):** agent2 is the SOLE entrant → guaranteed deterministic winner. Proves:
    pre-draw purchase rejected (pending), force-draw → 1 winner, check_status → 'won', **purchase →
    real on-chain tx**, amount 10 USDC, settled FROM agent2's wallet, entry → 'purchased',
    re-purchase rejected.
  - **Drop B (non-winner):** agent2 + the HUMAN demo wallet both enter (two KNOWN/resolvable
    wallets so the loser hits the REAL 'not a winner' guard, not an "unknown wallet" guard);
    force-draw → 1 winner/1 loser; the loser's purchase is rejected with 'not a winner'. (The loser
    is never charged — rejection precedes any transfer.)
  ‼️ **Fix made mid-iteration:** first run used an unfunded throwaway anvil key as the loser, which
  tripped the "no known demo wallet maps to …" guard *before* the not-a-winner check — semantically
  wrong rejection reason. Switched the second entrant to `DEMO_HUMAN_PK` (a registered demo wallet)
  so the genuine not-a-winner path is exercised. Both reject the purchase (no funds move), but the
  message now correctly says "not a winner".

**Commit:** `c86cd26` (M8 purchase tool + acceptance). Deployed: `railway up --ci --service 9f74a937…`
→ "Deploy complete"; newest deployment **`afbb9519-0e9c-4a5e-b61d-7a86d3046688` SUCCESS**.

**Acceptance test (literal output — run against the LIVE Railway URL):**
```
MCP_URL = https://worldcoinapp-production.up.railway.app/api/mcp
agent2 (winner/payer) = 0xE56F3bA6A66A51c0783069390278e14bdB5A1389
second entrant        = 0x14BAf4Ab5D7324bfdD9De78d5d7c0BF63F639781
OK   [A] agent2 enter_draw → entered (wallet 0xE56F3bA6A66A51c0783069390278e14bdB5A1389)
OK   [A] entry stored agent2's verified wallet (settles from it)
OK   [A] purchase before draw → rejected (entry is 'pending', not a winner)
OK   [A] force-draw → exactly 1 winner
OK   [A] check_status → 'won'
OK   [A] purchase → success
OK   [A] valid 32-byte tx hash: 0x4fd61725be7641366d35909ef4e73f912c59baf2911460d6bdf51532e4f45af1
OK   [A] amount == 10 USDC
OK   [A] settled FROM agent2's wallet
OK   [A] entry → 'purchased'
OK   [A] re-purchase → rejected (already purchased)
OK   [B] two distinct agents entered
OK   [B] force-draw → 1 winner, 1 loser
OK   [B] identified the loser (human) — status 'lost'
OK   [B] loser purchase → rejected ('not a winner')
OK   cleanup: throwaway drops deleted
M8_ACCEPTANCE: PASS (0 failures)
```
- **On-chain receipt VERIFIED:** tx `0x4fd61725be7641366d35909ef4e73f912c59baf2911460d6bdf51532e4f45af1`
  → `status: success`, block **30423266**, `from` agent2 `0xe56f3ba6…`, `to` USDC contract
  `0x66145f38…` (ERC-20 transfer). Explorer:
  https://sepolia.worldscan.org/tx/0x4fd61725be7641366d35909ef4e73f912c59baf2911460d6bdf51532e4f45af1
  (Also PASS locally before deploy: real tx `0x92b5a9734d7af4799be16715d63576682e25b26327b3e857b40c913eb8a5c63d`.)
- This is the **second real settlement tx** (M5 was the first) and the **first AGENT-path** one —
  satisfies the Definition-of-Done "≥2 real txs (one web, one agent)" agent half.

**Deviations from PRD:**
- Used throwaway drops (not the seeded Mac Mini) for the e2e so the demo state stays pristine and the
  test is self-cleaning/reproducible — the PRD's "reproducible after an admin reset" intent, met by
  create+delete rather than reset. (M10 will wire the full Mac-Mini reset choreography.)
- AgentBook registration step (PRD M8 step 2) is the same World-App-gated flow noted in M7 — the
  demo wallets aren't AgentBook-registered, so the agent identity uses the wallet-scoped fallback
  humanId. The SIGNATURE (the real auth primitive) IS enforced, and the agent settles from ITS OWN
  verified wallet. Honest caveat already documented in M7.

**⚠️ WALLET BALANCES NOW (post-M8 — important for M9/M10):** agent2 sent 10 USDC in EACH of the local
+ live acceptance runs (2× 10 = 20 USDC out, both to the default receiver = agent1). Rough state:
agent2 ~30 USDC, agent1 (RECEIVER) ~51 USDC, human ~39 USDC; all still ~0.0099 ETH gas. Re-check before
M9/M10 with `pnpm exec tsx scripts/check-balances.ts`. **For M9 the WEB winner pays from the `human`
demo wallet** (map web entries → human) — keep it funded (≥10 USDC + gas). Faucets: USDC
https://faucet.circle.com (Worldchain Sepolia ~20/2h), gas https://www.alchemy.com/faucets/world-chain-sepolia.

**NOTES FOR NEXT ITERATION (start M9 — Web purchase UI + pop-brutalist design pass):**
- **STUDY `webinspo/` FIRST** (image.png Sui Overflow, image2.png Seal, image3.png Gumroad, image4.png
  Balenciaga) + RALPH_GUIDE §11 before touching UI. Pop-brutalist: bold oversized display type, hard
  edges, thick (2px+) black borders, blocky cards w/ hard/offset shadows, ONE canvas (cream OR black),
  ONE electric accent (acid/lime green). Editorial drop-campaign layout, small grid of featured cards.
  Define theme tokens (font/accent/border/shadow) globally in Tailwind so `/admin` matches too.
- **Web winner flow:** a `won` web entry shows a "YOU WON — PURCHASE" CTA → settle. Simplest convincing
  path: **server-side settle from the `human` demo wallet** (mirror the agent path; the web entry's
  `wallet_address` is already supported by `insertWebEntry` — set it to the human wallet at entry time).
  Reuse `POST /api/drops/:id/purchase` (M6, already live) OR call `purchaseForEntry`. The money path is
  100% proven (M5/M6/M8) — M9 is mostly UI + wiring the human wallet to web entries.
- **Existing UI to restyle:** landing `app/page.tsx` (lists drops as cards), `app/drops/[id]/page.tsx`
  (entry page: variant chips + fairness count), `components/drop-entry-panel.tsx`,
  `components/world-id-entry.tsx` (IDKit v4 flow), `app/admin/page.tsx`. Add the winner/purchase states
  + a bold **"fairness" stat block** (total unique humans entered, duplicates blocked) — the visible
  Sybil proof for judges. shadcn/ui + Tailwind v4 already installed; `components/ui/button.tsx` exists.
- **Cross-surface check (M9 step 5):** web + agent entries to the same drop both honor uniqueness and
  both show in the admin/operator view (agent entries have `source='agent'`, web `source='web'`).
- **Capture a landing-page SCREENSHOT into PROGRESS.md at M9** as proof it matches the direction.
- Reusable IDs unchanged: app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`, MCP at
  `…/api/mcp`. Mac Mini `c27f512e-…` (open), Mac Studio `aafd0d75-…` (coming_soon), both seeded live with
  variants + `world_action_id`. ADMIN_SECRET + WORLD_* + DEMO_* + WORLD_CHAIN_SEPOLIA_RPC on Railway.
  Redeploy: `railway up --ci --service 9f74a937… -m "<msg>"`.
- ⚠️ Carryover gotchas unchanged (Next 16 `await ctx.params`; lazy `@/lib/db`; `env -u DATABASE_URL
  pnpm build`; Drizzle errors on `err.cause.code`; ES2017 → `BigInt(0)`; Railway Metal builder Dockerfile
  limits; tsx scripts need async `main()`). Still on branch `build/m3-admin-plane`.


---

## 2026-06-13 — iter-007 — M9 Web purchase UI + pop-brutalist design pass + cross-surface
**Status of M9:** ACCEPTED

**Did:** (same branch `build/m3-admin-plane`, continued after M8)
- **Global pop-brutalist theme** (`app/globals.css`): committed to a **cream canvas**
  (`#f4f1e8`) with a subtle **blue grid background**, **acid/lime accent** (`#c6ff2e`),
  thick **3px black borders**, **hard offset shadows** (`box-shadow: 6px 6px 0 ink`), and
  **square corners** (all `--radius-*` → 0). Remapped the shadcn tokens onto this palette so
  `/admin` and any shadcn component inherit the look; `.dark` kept identical to the light
  canvas (nothing inverts). Added reusable component classes: `.brutal`, `.brutal-lime`,
  `.brutal-hover` (presses into its shadow), `.display` (oversized uppercase), `.pill`.
  **Display font = `Archivo_Black`** wired via `next/font/google` in `app/layout.tsx`
  (`--font-display`); also fixed `--font-sans` to point at the geist-sans variable.
- **Landing** (`app/page.tsx`): editorial drop-campaign layout — top bar, huge hero
  ("BOT-PROOF DROPS FOR **REAL HUMANS**" with the lime highlight), a **fairness stat block**
  (total unique humans / 1-slot-per-human / live drops / ∞ duplicates blocked), and a small
  **grid of featured product cards** (live Mac Mini + coming-soon Mac Studio) with chunky
  color image-fields, status pills, price, variant chips, and an arrow CTA.
- **Drop page** (`app/drops/[id]/page.tsx`): big lime product block + hard shadow, oversized
  name + `$price`, a **fairness stat block broken out by surface** (unique humans · web/World ID
  · agent/AgentKit — the cross-surface proof, M9 step 5), brutalist variant chips, and the
  full entry → draw → winner-purchase flow.
- **Web winner flow** (`components/world-id-entry.tsx`, restyled + extended): the full state
  machine — verify (IDKit v4) → enter (captures the returned entry id) → **poll**
  `/api/drops/:id/entry-status` → on `won` show the **"YOU WON ✦ — PURCHASE"** CTA → POST
  `/api/drops/:id/purchase` (real USDC settlement) → **"PURCHASED ✓"** with an explorer link.
  Also renders lost / expired / already-entered states.
- **Backend wiring (the only new logic M9 adds — money path was 100% proven in M5/M6/M8):**
  - `app/api/drops/[id]/enter/route.ts` now attaches the **`human` demo wallet address** to web
    entries (via `getWallet("human").address`) so a web winner can settle. Key stays server-side
    (resolved at purchase time via `getWalletByAddress`), mirroring the agent path.
  - **NEW** `GET /api/drops/[id]/entry-status?entryId=` — poll a web entry's draw status
    (won/lost/purchased/expired) + purchase deadline. Read-only, no PII, no auth.
  - **NEW** `GET /api/admin/drops/[id]/entries` (auth-gated) — the operator cross-surface view:
    every entry with `source` (web/agent) + status + truncated human_key + counts.
- **Admin console** (`app/admin/page.tsx`): restyled to the theme; loads each drop's entries and
  shows a **web/agent cross-surface list** (colored source + status chips) plus
  open/close/draw/reset/flip/seed/+dummy affordances. Log pane styled lime-on-ink.
- **Screenshots** captured with a local prod (standalone) server + headless chromium
  (`scripts/screenshot.mjs`, playwright-core; chromium-headless-shell downloaded to
  `~/.cache/ms-playwright`, missing `libnspr4/libnss3` extracted from apt .debs into
  `/tmp/chromedeps` and put on `LD_LIBRARY_PATH` — see gotcha below). Saved to
  **`docs/screenshots/m9-landing.png`** and **`docs/screenshots/m9-drop.png`** (committed) —
  they match the pop-brutalist direction (cream + blue grid, lime accent, thick borders, hard
  shadows, oversized uppercase type, campaign grid).
- **`scripts/m9-acceptance.ts`** — drives the EXACT production code paths the UI uses, end to
  end, with real money (a real World ID proof can't be produced headlessly — same M4 caveat).

**Commit:** `33497c7` (M9 full slice). Deployed: `railway up --ci --service 9f74a937…` →
"Deploy complete"; newest deployment **`6bf1f9a8-24e2-4a13-8dd7-d8f1ef4d29b3` SUCCESS**.

**Acceptance test (literal output — run against the LIVE Railway URL):**
```
M9 acceptance — web purchase + cross-surface on chain 4801
BASE_URL = https://worldcoinapp-production.up.railway.app
OK   web entry recorded source='web'
OK   web entry stored the human demo wallet (M9 wiring)
OK   agent entry recorded source='agent' on the SAME drop
OK   duplicate WEB nullifier blocked (Sybil gate, web surface)
OK   duplicate AGENT humanId blocked (Sybil gate, agent surface)
OK   GET /api/admin/drops/:id/entries → 200
OK   admin view: 1 web entry
OK   admin view: 1 agent entry
OK   admin entries route is auth-gated (401 without secret)
OK   POST /api/admin/drops/:id/draw → 200
OK   draw produced exactly 1 winner
OK   the WEB entry is the seeded winner (deterministic)
OK   web entry status → 'won'
OK   agent entry status → 'lost'
OK   purchase → 200
OK   valid 32-byte tx hash
OK   amount == 10 USDC
OK   purchase result status == 'purchased'
OK   web entry status → 'purchased'
OK   orders row linked to the web entry
OK   orders.status == 'confirmed'
OK   settled FROM the human demo wallet
OK   non-winner (agent) purchase → 403 not a winner
OK   throwaway drop deleted (cascade cleaned entries/orders)
M9_ACCEPTANCE: PASS (0 failures)
```
- **Real web-path settlement tx (chain 4801):**
  `0x7b3cdbd18891018d1f0f9efca5cd641817042f9bcbae31f7fd8c0c299b1ae41a`
  https://sepolia.worldscan.org/tx/0x7b3cdbd18891018d1f0f9efca5cd641817042f9bcbae31f7fd8c0c299b1ae41a
  Independently verified: **status success, block 30423657**, `from` human wallet
  `0x14BAf4…`, `to` USDC contract `0x66145f38…` (ERC-20 transfer). This is the **WEB half** of
  the Definition-of-Done "≥2 real txs (one web, one agent)" — M8 `0x4fd61725…` was the agent half.
- Live landing/build checks: `/api/health` `{"ok":true}`, landing serves "BOT-PROOF / REAL
  HUMANS / The Collection / Mac Mini"; new routes live (`/api/admin/drops/:id/entries` → 401
  no-auth, `/api/drops/:id/entry-status` → 404 bogus entry). `env -u DATABASE_URL pnpm build`
  PASS; `pnpm typecheck` PASS.
- **Seeded demo state pristine after the run:** Mac Mini open (2 var, $10), Mac Studio
  coming_soon (2 var, $20) — the acceptance used throwaway drops (create+delete).

**Deviations from PRD:**
- ‼️ **Web winner flow is server-side settle (no in-browser wallet connect).** PRD M9 step 1
  explicitly allows "a server-side settle for demo simplicity — pick the simplest convincing
  path and record it." We map a web entry → the **`human` demo wallet** at `/enter` time
  (stored on `entries.wallet_address`), then the purchase route resolves the key server-side
  (`getWalletByAddress`). No browser wallet/WalletConnect — convincing, reproducible, and the
  key never crosses the wire. This mirrors the agent path exactly.
- ‼️ **Real World ID proof can't be produced headlessly** (same as M4). The acceptance drives
  the real production funnels (`insertWebEntry` = what `/enter` calls post-verify) and the real
  **live HTTP** draw + purchase routes (the exact routes the UI hits). The only human-in-the-loop
  step is holding a phone to verify in World App — that IS the M10 live demo. The M4 live-RP
  wiring (422 on a bad proof) already proved the verify endpoint is real.
- Added two read routes not in the PRD's verbatim list (`entry-status`, admin `entries`) — both
  are thin reads the UI needs; the admin one is auth-gated.
- Added `playwright-core` as a **devDependency** (screenshot tooling only; no postinstall browser
  download, build verified clean with it present). Not used at runtime.

**⚠️ WALLET BALANCES NOW (post-M9 — for M10):** human paid 10 USDC this run (39→**29 USDC**);
agent1 (receiver) **81 USDC**; agent2 **10 USDC**; all ~0.0099 ETH gas. The secret_keys agent
wallet still has 20 USDC / 0 ETH (can't pay gas — don't use it to send). For M10's TWO
back-to-back live runs, ensure the WINNING wallet for each path has ≥10 USDC + gas: web winner =
**human** (29 USDC, good for ~2 runs), agent winner = **agent2** (10 USDC — good for exactly 1;
**top up agent2 before a second agent run** via faucet, or seed the agent win to a wallet with
more headroom). Faucets: USDC https://faucet.circle.com (Worldchain Sepolia ~20/2h), gas
https://www.alchemy.com/faucets/world-chain-sepolia.

**NOTES FOR NEXT ITERATION (start M10 — Demo hardening + reset choreography + dry run):**
- **Create `DEMO_RUNBOOK.md`** — the 5-act script (RESEARCH_REPORT §9): web double-entry block →
  agent enters via MCP → seeded draw → real USDC settlement w/ explorer link → coming-soon query
  via MCP. Include the **exact seed** that makes the intended winner win, the clicks/commands per
  act, and the **reset choreography** (reset Mac Mini, re-confirm balances, re-set seed, flip
  Mac Studio back to coming_soon). Map each act → the 3 Track-A qualification requirements.
- **One-button reset-to-demo-start.** `resetDrop` already exists (scoped, re-opens, clears
  drawn_at) + an admin `reset` action. For the FULL choreography you also need: re-set the
  Mac Mini seed (so the staged winner wins), and ensure Mac Studio is `coming_soon`. Consider a
  new admin action `reset-demo` (or a small script) that does: reset Mac Mini + set its seed +
  flip Mac Studio→coming_soon, in one call. The `/admin` console can get a single "RESET DEMO"
  button. NOTE the demo reset is **scoped to the drop's data** (seeded products survive).
- **Pre-demo checklist script** (`scripts/predemo-check.ts` or similar): print a green/red board
  for wallet USDC+ETH balances, drop statuses (Mac Mini open / Mac Studio coming_soon), the seed
  value, MCP reachability (`…/api/mcp` lists 5 tools), and World ID action existence on each drop.
- **Full rehearsal:** run all 5 acts on the **live Railway URL** TWICE back-to-back, resetting
  between, capturing the two real tx hashes into PROGRESS.md. The acceptance is "no manual DB
  surgery between runs."
- **Seeding a SPECIFIC web winner among real entries:** the rankKey is `SHA-256(seed:entryId)`
  ascending; entry ids aren't known until entry time, so for a staged demo the simplest reliable
  approach is to make the intended winner the **sole/first real entrant** of that surface, or
  brute-force a seed suffix after entries exist (as `scripts/m9-acceptance.ts` does — search seeds
  until the target entry sorts first). Document whichever you pick in the runbook.
- Reusable IDs unchanged: app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`,
  MCP `…/api/mcp` (5 tools incl. purchase). Mac Mini `c27f512e-…` (open, action `drop_c27f512e-…`),
  Mac Studio `aafd0d75-…` (coming_soon, action `drop_aafd0d75-…`). ADMIN_SECRET + WORLD_* + DEMO_*
  + WORLD_CHAIN_SEPOLIA_RPC on Railway. Redeploy: `railway up --ci --service 9f74a937… -m "<msg>"`.
- ⚠️ Carryover gotchas (all still apply): Next 16 route `params` is a Promise (`await ctx.params`);
  `@/lib/db` is a lazy proxy; **build must pass `env -u DATABASE_URL pnpm build`**; Drizzle unique
  errors on `err.cause.code`; tsconfig ES2017 → `BigInt(0)` not `0n`; Railway Metal builder rejects
  `# syntax=` / BuildKit cache mounts; **tsx scripts need an async `main()`** (top-level await fails
  esbuild's CJS transform). For screenshots: chromium needs nss/nspr libs — extract from apt
  .debs (`apt-get download libnspr4 libnss3` → `dpkg-deb -x` → `LD_LIBRARY_PATH`) since
  `playwright install --with-deps` needs sudo. Still on branch `build/m3-admin-plane` (nothing
  merged to main).

---

## 2026-06-13 — iter-008 — M10 Demo hardening + reset choreography + live dry run ×2
**Status of M10:** ACCEPTED · **🎉 PROJECT COMPLETE (M0–M10 all accepted, DoD met)**

**Did:** (same branch `build/m3-admin-plane`, continued after M9)
- **One-button reset choreography.** Added **`resetDemo()`** to `lib/drops.service.ts` — a single
  call that returns the whole system to "Act 1": resets the live drop (**Mac Mini**) via the
  existing `resetDrop` (clears its entries+orders, re-opens, clears `drawn_at`), additionally
  **clears the `draw_seed`** (fresh slate each run), and flips **Mac Studio** back to
  `coming_soon` if it was opened. Scoped to the seeded demo drops BY NAME — nothing else touched.
  Wired as the admin action **`reset-demo`** in the `:id/:action` dispatch (the `:id` is ignored;
  the action resolves the demo drops by name, so the `/admin` button can call it on any id). Added
  a prominent **⟳ RESET DEMO** button to `app/admin/page.tsx`.
- **Pre-demo checklist** `scripts/predemo-check.ts` — prints a 🟢/🔴 board (read-only): app+DB
  health, wallet USDC+ETH (human & agent2 each need ≥$10+gas), Mac Mini `open`/0-entries/seed-clear,
  Mac Studio `coming_soon`, both drops' World ID v4 action, and MCP reachability (advertises the 5
  tools). Exits non-zero on any RED. Confirmed it CATCHES a real issue: after the dry run it flagged
  `human` at 9 USDC (< the $10 next-run threshold) → I rebalanced (see below) → all-green.
- **`DEMO_RUNBOOK.md`** — the 5-act judge script (pitch, live coordinates, demo wallets, the 5 acts
  with exact clicks/commands, the seedable-draw staging note, the one-button reset choreography, the
  full automated rehearsal command, the **3 Track-A qualification-requirement traceability table**,
  and live-demo first-aid). Cold-runnable in <5 min (DoD).
- **`scripts/m10-acceptance.ts`** — the full 5-act demo run **TWICE back-to-back on the LIVE Railway
  URL** with `reset-demo` between, no manual DB surgery. Acts on the **seeded Mac Mini drop** (not
  throwaways): ACT1 web double-entry block (real `insertWebEntry` funnel + replay → `AlreadyEntered`),
  ACT2 agent enters via **live MCP** with a real AgentKit signature (+ unsigned → rejected, + replay
  → Sybil-blocked), ACT3 seeded draw via admin HTTP (seed searched so the web entry sorts first →
  web wins, agent loses), ACT4 **real USDC purchase** via the live `/purchase` route (+ loser → 403),
  ACT5 coming-soon `get_drop_info(Mac Studio)` via MCP. Reset → verify open/0-entries/coming_soon →
  run again. Same M4/M9 caveat: a real World ID *proof* can't be produced headlessly, so the web
  entry uses the production funnel while draw/purchase/agent-path all go through the **live routes**.

**Commits:** `f007479` (reset-demo action+button, predemo-check, m10-acceptance),
`de037b5` (DEMO_RUNBOOK.md). Deployed: `railway up --ci --service 9f74a937…` → "Deploy complete";
newest deployment **`082231c9-86f0-491c-84f9-5219810e9593` SUCCESS**.

**Acceptance test (literal output — TWO clean back-to-back runs on the LIVE Railway URL):**
```
M10 acceptance — full demo ×2 on chain 4801
BASE_URL = https://worldcoinapp-production.up.railway.app
  [reset] OK ×5  (open / seed-clear / coming_soon / 0 entries)
== DEMO RUN 1 == ACT1 web dup-block · ACT2 agent MCP enter (+unsigned reject +replay block)
  · ACT3 seeded draw (web wins, agent loses) · ACT4 real purchase + loser 403 · ACT5 coming-soon MCP
  RUN 1 tx: 0x4c7ed7bbbf19d1d50925cb3169dbf7c2da37402f467d137718fb826cc87cd17f
  [reset] OK ×5
== DEMO RUN 2 == (same arc)
  RUN 2 tx: 0x0069bf2684db32cbed19544899614fe717df55fd106233a16b0bf76f2a8cf864
  [reset] OK ×5
M10_ACCEPTANCE: PASS (0 failures)
```
- **Both settlement txs independently verified on-chain** (`getTransactionReceipt`):
  - RUN1 `0x4c7ed7bb…` → status **success**, block **30423925**, from human `0x14baf4…`, to USDC `0x66145f38…`.
  - RUN2 `0x0069bf26…` → status **success**, block **30423926**, from human `0x14baf4…`, to USDC `0x66145f38…`.
  - Explorer: https://sepolia.worldscan.org/tx/0x4c7ed7bbbf19d1d50925cb3169dbf7c2da37402f467d137718fb826cc87cd17f
    · https://sepolia.worldscan.org/tx/0x0069bf2684db32cbed19544899614fe717df55fd106233a16b0bf76f2a8cf864
- **Pre-demo checklist:** after the run `human` was 9 USDC → flagged 🔴 → rebalanced agent1→human 25
  USDC (real tx `0xc91b6da7d2db1face0b65cef935846737f348aa483108226daf32ca2f05634d3`, confirmed) →
  re-ran → **✅ ALL GREEN — demo-ready** (human 34 / agent2 10 / agent1 76 USDC; Mac Mini open+0
  entries+seed-clear; Mac Studio coming_soon; MCP 5 tools).

**Deviations from PRD:** none material.
- M10 acceptance drives the web ENTRY via the production `insertWebEntry` funnel (a real World ID
  proof is un-headless-able — the documented M4/M9 caveat the PRD allows); the draw, purchase, agent
  entry, and coming-soon query all go through the **live HTTP/MCP routes** (the exact demo paths).
- `reset-demo` is a single system-wide action layered on the existing per-drop `resetDrop` (it adds
  seed-clear + the Mac-Studio flip), rather than a separate top-level route — keeps the admin surface
  one dispatch.

**Definition of Done (PRD §5) — all checked:**
- [x] M0–M10 acceptance tests all pass, recorded here.
- [x] Live Railway URL runs the full demo and resets cleanly (M10: 2 runs back-to-back, reset between).
- [x] ≥2 real USDC settlement txs (one web, one agent): **web** M9 `0x7b3cdbd…` + M10 `0x4c7ed7bb…`/`0x0069bf26…`;
      **agent** M8 `0x4fd61725…`. (M5 `0xa87870cf…` was the first money-path proof.)
- [x] One-slot-per-human enforced & demonstrably blocks duplicates on BOTH surfaces (Act1 web, Act2 agent).
- [x] `DEMO_RUNBOOK.md` lets a human re-run from cold in <5 min (checklist + ⟳ RESET DEMO + 5 acts).
- [x] No provisioned cloud resource was ever deleted (additive only; only rows/seed cleared).

**FINAL STATE / NOTES (project complete):**
- Live URL `https://worldcoinapp-production.up.railway.app` — **demo-ready, all-green.** Mac Mini
  `c27f512e-…` open (action `drop_c27f512e-…`, $10, 1 slot, 0 entries, seed clear); Mac Studio
  `aafd0d75-…` coming_soon (action `drop_aafd0d75-…`, $20). MCP at `…/api/mcp` (5 tools).
- **Demo loop:** `scripts/predemo-check.ts` (green board) → run the 5 acts (DEMO_RUNBOOK.md) → ⟳ RESET
  DEMO (or `POST …/c27f512e-…/reset-demo`) → repeat. Full auto rehearsal: `scripts/m10-acceptance.ts`.
- **Wallets now:** human 34 USDC, agent2 10, agent1 76 (receiver), all ~0.0099 ETH gas; secret_keys
  agent wallet 20 USDC / 0 ETH (can't send — gasless). Top-up faucets if a run drains them: USDC
  https://faucet.circle.com (Worldchain Sepolia ~20/2h), gas https://www.alchemy.com/faucets/world-chain-sepolia.
- **Branch:** all of M3–M10 live on **`build/m3-admin-plane`**; nothing merged to `main` yet. If a
  human wants it on main, open a PR from this branch (the loop never commits straight to main).
- Reusable IDs: app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, Railway project `c3751ac9-2806-4e9e-83d7-30504b6a059f`
  (env production `928cd32e-…`). Redeploy: `railway up --ci --service 9f74a937… -m "<msg>"`.
- ⚠️ Carryover gotchas (still apply if anyone extends this): Next 16 route `params` is a Promise
  (`await ctx.params`); `@/lib/db` is a lazy proxy; build must pass `env -u DATABASE_URL pnpm build`;
  Drizzle unique errors on `err.cause.code`; tsconfig ES2017 → `BigInt(0)` not `0n`; Railway Metal
  builder rejects `# syntax=` / BuildKit cache mounts; tsx scripts need an async `main()`.

---

## 2026-06-14 — iter-009 — M11 Real time-driven lifecycle (autonomous open + draw)
**Status of M11:** ACCEPTED

**Did:** (new branch `build/m11-lifecycle` off `main` — carries the prior uncommitted UI/seed
work too; M0–M10 still live on `build/m3-admin-plane`, none merged to main)
- **`lib/lifecycle.service.ts`** — the transition engine. `applyDueTransitions(now?)`:
  - `coming_soon` with `opens_at <= now` → `open` (conditional UPDATE `WHERE status='coming_soon'`
    elects one caller; concurrent callers see 0 rows and skip).
  - `open` with `closes_at <= now` and `drawn_at IS NULL` → **atomic draw guard** then `runDraw`.
    The guard is a conditional UPDATE `SET drawn_at=now WHERE id=? AND status='open' AND drawn_at IS NULL`
    `RETURNING id` — whoever updates a row OWNS the draw; everyone else (other ticks, lazy reads,
    extra instances) gets 0 rows and no-ops ⇒ **no double-draw**. If `runDraw` then throws, the
    claim is rolled back (`drawn_at=null`) so a later tick can retry.
  - Reuses the **M6 `runDraw` path VERBATIM** (CSPRNG when no seed) — only the *trigger* changed
    from an admin call to the wall clock. Never throws (per-section try/catch + per-drop).
  - **`dropTiming(drop, now?)`** helper → `{ phase, opensAt, closesAt, secondsUntilOpen,
    secondsUntilClose }` for the M12 countdowns (phases: coming_soon | open | closing | drawn).
- **`lib/lifecycle.ticker.ts`** — `startLifecycleTicker()`: nodejs-only `setInterval`
  (`LIFECYCLE_TICK_MS`, default **5000ms**) running `applyDueTransitions()`. Singleton-guarded on
  globalThis, re-entrancy-guarded (skips a tick if the prior one is still running), `handle.unref()`.
  Logs `opened`/`drew` lines. **This is what makes "wait 2h tab-closed and it still fires" literally
  true** (one Railway web instance — genuinely autonomous for this demo, not a distributed scheduler;
  the atomic guard makes it safe even if scaled).
- **`instrumentation.ts`** (repo root) — Next 16 `register()` hook. Starts the ticker ONLY when
  `NEXT_RUNTIME === "nodejs"` AND `DATABASE_URL` is set, so `next build`'s page-data collection
  (which runs WITHOUT DATABASE_URL) never connects or draws. Dynamic-imports the ticker. Wrapped so
  a failure can't block server readiness. (Doc read: `node_modules/next/dist/docs/01-app/
  03-api-reference/03-file-conventions/instrumentation.md`.)
- **Lazy trigger (on read):** `applyDueTransitions()` at the top of **`listDrops()`** (via a
  **dynamic** `import()` — a static import would create the cycle lifecycle→draw→drops) and in
  **`GET /api/drops/:id/entry-status`** (static import; no cycle there). So any page load / poll
  reflects the true current state; the entry-status poll that crosses `closes_at` sees the drawn
  state immediately even before the next ticker fire.
- **`scripts/m11-acceptance.ts`** — the no-intervention gate (throwaway drops, self-cleaning):
  creates a `coming_soon` drop (opens_at 5s in the past) + an `open` drop (closes_at = now+CLOSE,
  2 entries, **no seed**), **sleeps WAIT seconds doing NOTHING** (no admin call, no listDrops, no
  entry-status, no applyDueTransitions), then asserts via **direct DB reads** (getDrop / raw select
  — these DON'T trigger transitions) that the autonomous TICKER opened + drew them, and a winner
  settles a real on-chain USDC tx on 4801 (verified by `getTransactionReceipt`). Env-tunable:
  `M11_CLOSE_SECONDS` (def 20), `M11_WAIT_SECONDS` (def CLOSE+25).

**Commit:** `3618115` (engine + ticker + instrumentation + lazy triggers + acceptance; also carries
the `resetDemo` rewrite for the now-both-live demo drops). Deployed:
`railway up --ci --service 9f74a937…` → "Deploy complete" (exit 0); newest deployment
**`6033c389-5b35-4c92-97ed-21cbafca37e2` SUCCESS**.

**Acceptance test (literal output — run TWICE: local standalone server, then LIVE Railway ticker):**
- **Local** (standalone `node server.js`, `LIFECYCLE_TICK_MS=3000`, CLOSE=8 WAIT=18):
  `M11_ACCEPTANCE: PASS (0 failures)`; real tx
  `0xdd2b7c716953b8b302f52ce0c1ab02802474f5a39c6b1b9684325fb12d124145` (block 30435272). Server log:
  `[lifecycle.ticker] opened drop "__m11_open_…"` + `drew drop "__m11_draw_…" — 1 winner(s), 1 loser(s)`.
- **LIVE Railway** (deployed server's own ticker @5000ms; my local script ONLY wrote state + slept,
  CLOSE=25 WAIT=45):
  ```
  OK   [A] coming_soon → open fired AUTONOMOUSLY (no admin call)
  OK   [B] open → closed fired AUTONOMOUSLY at closes_at
  OK   [B] drawn_at stamped by the autonomous draw
  OK   [B] exactly total_slots (1) winner — got 1
  OK   [B] the other entry is a loser — got 1
  OK   [B] real tx hash is a valid 32-byte hash
  OK   [B] amount == 10 USDC (drop price)
  OK   [B] winner entry → 'purchased'
  OK   [B] on-chain receipt status == success (block 30435376)
  OK   [B] orders row confirmed + linked
  M11_ACCEPTANCE: PASS (0 failures)
  ```
  Real tx `0x075908558c3320c6ace1653df1af9fdd2a4e1793fdf5a38cf4c78c0af0506c46`
  (https://sepolia.worldscan.org/tx/0x075908558c3320c6ace1653df1af9fdd2a4e1793fdf5a38cf4c78c0af0506c46 ·
  block 30435376, status success).
  **Live server logs confirm the DEPLOYED ticker did it** (not my script):
  `[lifecycle.ticker] opened drop "__m11_open_1781418124702" (facf1487-…)` +
  `drew drop "__m11_draw_1781418125081" (66a72832-…) — 1 winner(s), 1 loser(s)`.
- Build/typecheck: `pnpm typecheck` PASS; **`env -u DATABASE_URL pnpm build` PASS** (instrumentation
  correctly no-ops at build — ticker never starts without DATABASE_URL). Live `/api/health`
  `{"ok":true}`, `/api/health/db` `{"db":"ok"}`.
- **Seeded demo state intact** after the run: `GET /api/drops` → Mac Mini open ($10, 2 var),
  GeForce RTX 5090 open ($50, 1 var). Both have `opensAt/closesAt = null` (no timers yet — M13's
  `launch-demo.ts` sets the real 1:30/2h timers; M11 is the engine that HONORS them).

**Deviations from PRD:** none material.
- Lazy trigger in `listDrops()` uses a **dynamic** `import("@/lib/lifecycle.service")` rather than a
  top-level import — required to avoid the static require cycle `drops → lifecycle → draw → drops`.
  Same effect (runs before the read), no cycle. Documented in-code.
- The atomic draw guard PRE-stamps `drawn_at` in the claim UPDATE; `runDraw` also stamps it (harmless
  re-stamp). The claim is what makes election atomic; runDraw stays untouched (M6 contract preserved).
- No new env vars required (ticker interval optional via `LIFECYCLE_TICK_MS`, defaults 5000).

**NOTES FOR NEXT ITERATION (start M12 — Timer UI + SOLD OUT + winner page):**
- **The lifecycle ENGINE is done & live.** M12 is the UI layer that VISUALIZES it. The data hooks
  exist: **`dropTiming(drop)`** in `lib/lifecycle.service.ts` returns `{ phase, opensAt, closesAt,
  secondsUntilOpen, secondsUntilClose }`. `entry-status` route already returns `status`/`drawnAt`/
  `purchaseDeadline` and applies due transitions on read.
- ‼️ **There is a LOT of uncommitted UI groundwork already on this branch** (carried from before):
  a full scroll-deck landing (`components/drop-deck.tsx`, `item-panel.tsx`, `hero-panel.tsx`,
  `scroll-deck.tsx`, `scroll-cue.tsx`, `scroll-to-button.tsx`, `hero-model-stage*.tsx`), an
  `app/[slug]/page.tsx` deep-link route, `lib/drops.presentation.ts` (slug/photo/spec display
  metadata keyed by drop name), a rewritten `app/page.tsx`, product images under `public/products/`
  + 3D models under `public/models/` + `public/draco/`, and screenshot scripts (`scripts/shot-*.mjs`).
  These are **NOT yet committed** (and not part of the M11 commit `3618115` except `drops.service.ts`
  + `seed.ts`/`page.tsx` already-modified bits). **M12 should fold these in**: commit them, then add
  the timer components (`components/launch-timer.tsx` client countdown calling `router.refresh()` on
  zero-cross), wire SOLD OUT into `item-panel.tsx` (currently it shows a flat "Not open for entry"),
  and build `app/win/[entryId]/page.tsx` (the screenshottable winner page; reuse
  `POST /api/drops/:id/purchase` which resolves the winner wallet server-side). Thread
  `opensAt/closesAt/drawnAt` through `drop-deck.tsx` → `item-panel.tsx`.
- **Screenshots for M12 use NIX Chromium** (PRD M12 step 4 replaces the M9 apt-.deb/LD_LIBRARY_PATH
  hack): `nix build nixpkgs#chromium`; point playwright-core's `executablePath` at
  `${chromium}/bin/chromium` (resolve via `nix eval --raw nixpkgs#chromium.outPath` or
  `nix build --print-out-paths`; honor a `CHROMIUM_BIN` override). Capture
  `docs/screenshots/m12-winner.png` in a `won` state.
- **Wallets now** (post-M11, 2 acceptance settlements of 10 USDC each, both to agent1 receiver):
  re-check with `pnpm exec tsx scripts/check-balances.ts`. Pre-M11 they were human 34 / agent2 10 /
  agent1 76 USDC, all ~0.0099 ETH. M11 ran 2× 10-USDC FROM human → human now ~14 USDC. Keep the
  WINNER wallet (web=human, agent=agent2) ≥10 USDC + gas for M12's winner-page real purchase. Faucets:
  USDC https://faucet.circle.com (Worldchain Sepolia ~20/2h), gas
  https://www.alchemy.com/faucets/world-chain-sepolia.
- **Reusable IDs unchanged:** app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`,
  MCP `…/api/mcp` (5 tools). Mac Mini `c27f512e-af27-4963-88d3-a54bdab108a6` (open, action
  `drop_c27f512e-…`); GeForce RTX 5090 `aafd0d75-d313-4aec-8b26-e558a6ffd9ba` (open, action
  `drop_aafd0d75-…`, reused from the old Mac Studio row). ADMIN_SECRET + WORLD_* + DEMO_* +
  WORLD_CHAIN_SEPOLIA_RPC on Railway. Optional `LIFECYCLE_TICK_MS` (def 5000) is set nowhere = 5s.
  Redeploy: `railway up --ci --service 9f74a937… -m "<msg>"`.
- ⚠️ Carryover gotchas (all still apply): Next 16 route `params` is a Promise (`await ctx.params`);
  `@/lib/db` is a lazy proxy; **build must pass `env -u DATABASE_URL pnpm build`** (the ticker MUST
  stay nodejs+DATABASE_URL-guarded — never run at build); Drizzle unique errors on `err.cause.code`;
  tsconfig ES2017 → `BigInt(0)` not `0n`; Railway Metal builder rejects `# syntax=` / BuildKit cache
  mounts; tsx scripts need an async `main()`. Branch: **`build/m11-lifecycle`** (off main; carries
  the uncommitted UI groundwork — M12 commits it). M0–M10 are on `build/m3-admin-plane`.

---

## 2026-06-14 — iter-010 — M12 Timer UI + SOLD OUT state + dedicated winner page
**Status of M12:** ACCEPTED

**Did:** (same branch `build/m11-lifecycle`, continued after M11)
- **Committed the M12 UI base** (`c67f7db`) — folded in the previously-uncommitted scroll-deck
  groundwork the M11 notes flagged: `drop-deck`/`scroll-deck`/`hero-panel`/`item-panel`/
  `scroll-cue`/`scroll-to-button`/`hero-model-stage*`, `app/[slug]` deep-link route,
  `lib/drops.presentation.ts`, the rewritten `app/page.tsx`, `lib/seed.ts` (upserts the 2 live
  drops in place — preserves UUID + World ID action), self-hosted assets (`public/models`,
  `public/draco`, `public/products`), `@google/model-viewer` dep, and the `shot-*` scripts.
  **Gitignored** the heavy raw source dirs `3dmodels/` (35M), `5090/`, `macminis/` — not
  referenced by code (the app serves processed assets from `public/`).
- **`components/launch-timer.tsx`** (client) — live countdown. `mode="launch"` (coming_soon →
  opens_at, "LAUNCHES IN") / `mode="entry"` (open → closes_at, "ENTRIES CLOSE IN"). Format
  `Hh MMm` ≥1h (the 2h RTX drop), `MM:SS` <1h (the 90s Mac Mini). On **zero-cross calls
  `router.refresh()`** (once, via a ref guard) so the now-updated real M11 server state shows
  (open / SOLD OUT / winner) the instant the clock hits zero — the ticker would do it within ~5s
  anyway; this just makes the UI react immediately.
- **`components/item-panel.tsx`** — lifecycle-driven entry block: launch timer (coming_soon) →
  entry timer + `WorldIdEntry` (open) → **bold lime SOLD OUT block** + black "SOLD OUT" pill on
  the photo (closed/settled/drawn). `drop-deck.tsx` now threads `opensAt`/`closesAt`/`drawnAt`
  (ISO strings) through; `hero-panel.tsx` shows a small "next drop" launch countdown (soonest
  upcoming `opens_at`).
- **`app/win/[entryId]/page.tsx`** (server component) — the screenshottable winner page. States
  read from the REAL entry status: `won` (YOU WON ✦ + product/finish + PURCHASE CTA), `purchased`
  (PURCHASED ✓ + amount + real explorer tx link + hash, read via `getConfirmedOrderForEntry`),
  `lost`/`expired`/`pending` (honest), **bad-uuid → 404** (regex-guarded so a malformed id doesn't
  500 on the DB). Reuses **`POST /api/drops/:id/purchase`** which resolves the winner's wallet
  SERVER-SIDE from `entry.wallet_address` → works for **human OR agent** winner. Client purchase
  island `components/winner-purchase.tsx`. `world-id-entry.tsx` inline win state now links to
  `/win/[entryId]` (both surfaces converge on one page).
- **`lib/entries.service.ts`** — `getEntryById` + `getConfirmedOrderForEntry` (the tx for the
  purchased state).
- **`scripts/shot-winner.mjs`** — nix-Chromium screenshot (PRD M12 step 4; resolved
  `nix build nixpkgs#chromium --print-out-paths` → `…/bin/chromium`, passed via
  `CHROMIUM_BIN`/`executablePath`). **`scripts/m12-acceptance.ts`** — self-cleaning, real on-chain
  settlement.

**Commits:** `c67f7db` (M12 base) + `be70b8d` (M12 timer UI + SOLD OUT + winner page).
Deployed: `railway up --ci --service 9f74a937…` → "Deploy complete"; newest deployment
**`2adafed8-3f10-44c7-93df-a858adbe6850` SUCCESS**.

**Acceptance test (literal output — run LOCAL standalone, then LIVE Railway):**
- **LIVE** (`BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/m12-acceptance.ts`):
  ```
  OK   [A] /win/<bad-uuid> → 404 (no 500 crash)
  OK   [A] lost entry → NOT SELECTED
  OK   [A] pending entry → YOU'RE IN
  OK   [A] won entry → YOU WON
  OK   [A] won page shows product + photo
  OK   [B] purchase route → 200 ok
  OK   [B] real 32-byte tx hash
  OK   [B] entry → purchased
  OK   [B] on-chain receipt success (block 30435935)
  OK   [B] winner page now shows PURCHASED + tx
  OK   [C] auto-drew on the clock → closed (SOLD OUT)
  OK   [C] drawn_at stamped by the autonomous draw (no admin call)
  M12_ACCEPTANCE: PASS (0 failures)
  ```
  **Live winner-page settlement tx** `0x19a104eaff5dccb7d7ffad4b5ab59005c6948867f67869447e02884fc352660f`
  (https://sepolia.worldscan.org/tx/0x19a104eaff5dccb7d7ffad4b5ab59005c6948867f67869447e02884fc352660f ·
  block 30435935, receipt success). Local run earlier: PASS, tx `0x802a5ed3…` (block 30435790).
- **Manual winner-page purchase** (real flow, local): tx
  `0x8767ea388e53be2a0d12f4a2f09e2aab528f2b1ea90331f2547476ebe90fc533` (block 30435722, success) —
  the `/win/[entryId]` page then rendered PURCHASED ✓ + explorer link.
- **Screenshots committed:** `docs/screenshots/m12-winner.png` (won state, nix Chromium — product
  card + lime "YOU WON ✦" + PURCHASE CTA) and `docs/screenshots/m12-soldout.png` (the item panel in
  SOLD OUT — black pill + bold lime SOLD OUT block). The full launch-timer→entry-timer→SOLD OUT
  progression was verified in the real UI (deep-link screenshots) and via the DB reaching `closed`
  autonomously.
- Build/typecheck: `pnpm typecheck` PASS; **`env -u DATABASE_URL pnpm build` PASS** (`/win/[entryId]`
  in the route list); M12 files lint-clean. Live `/api/health` `{"ok":true}`, `/api/health/db`
  `{"db":"ok"}`, `/win/not-a-uuid` → 404.
- **Post-run state intact:** live `GET /api/drops` → exactly 2 seeded drops (Mac Mini open, RTX 5090
  open, both `drawnAt=null`) — no throwaways leaked. Wallets: Human 24 USDC, Agent2 10, Agent1 86,
  all ~0.0099 ETH (topped Human +40 from Agent1 mid-run via `/api/admin/test-transfer` so the
  web-winner path stays funded; tx `0x21ff3df7…`).

**Deviations from PRD:** none material.
- Added a **uuid regex guard** in the winner page (`/win/<bad-uuid>` → 404 instead of a 500 from the
  DB's invalid-uuid-syntax error). Not called out in the PRD but obviously correct.
- The throwaway drops the acceptance creates are NAMED "Mac Mini" so the winner page picks up the
  real product photo/accent for a representative screenshot — they're brand-new UUIDs, deleted at the
  end, and never appear on the deck (the deck's `drops.find` returns the first/seeded match), so the
  live seeded Mac Mini + its registered World ID action are untouched.
- `disable react-hooks/purity` on the one `Date.now()` in `drop-deck.tsx` (an async SERVER component
  — renders once per request; the client-purity rule is a false positive for RSCs).

**NOTES FOR NEXT ITERATION (start M13 — Live demo tooling + runbook):**
- **M13 is the LAST milestone.** When it's ACCEPTED, the whole project is done (M0–M13) → emit
  `RALPH-PROJECT-COMPLETE`. M11 (engine) + M12 (UI) are both live; M13 wires the real 1:30/2h timers
  and rewrites the runbook around the live flow.
- **Build `scripts/launch-demo.ts`** — sets timestamps ONLY (the M11 clock does the rest; the script
  opens/draws nothing): Mac Mini `status=open, opens_at=now, closes_at=now+90s, NO seed` (truly
  random); GeForce RTX 5090 `status=coming_soon, opens_at=now+2h, closes_at=now+2h+5m` (configurable
  via `MAC_MINI_SECONDS`/`RTX_HOURS`/`RTX_ENTRY_SECONDS`; optional off-by-default `--seed-human` to
  stage a guaranteed human win). Prints wall-clock open/close times + live URLs. ⚠️ The RTX 5090 row
  is currently `open` (M11 left both drops open with null timers) — `launch-demo.ts` must set it
  back to `coming_soon` with the +2h `opens_at` so the launch timer shows. Mac Mini → open + 90s.
- **`scripts/practice-agents.ts`** — OPTIONAL solo-rehearsal harness, explicitly NOT used in the live
  demo. agent1+agent2 call the **live MCP** `enter_draw(Mac Mini)` with real AgentKit sigs (reuse the
  `m10-acceptance.ts` MCP-client pattern), wait for the real `closes_at`, `check_status` → print
  WON/LOST + settlement tx. Label "practice only."
- **Rewrite `DEMO_RUNBOOK.md`** around the real live arc (Act1 run launch-demo → timers set; Act2
  presenter scans World ID on their phone, enters live; Act3 presenter asks their real agents via the
  MCP connector; Act4 everyone watches the real countdown hit zero → server draws itself → winner
  page / SOLD OUT appear; Act5 winner purchases — in-browser on `/win/[id]` or agent via MCP
  `purchase`). Keep the 2h NVIDIA raffle as the "leave it running, it really fires" proof, the
  practice harness, the `reset-demo` choreography, and the Track-A qualification mapping.
- **Reusable hooks for M13:** `dropTiming(drop)` (lifecycle.service) for any timing display;
  `/win/[entryId]` is the convergence page for both human + agent winners; `POST /api/drops/:id/purchase`
  resolves the wallet server-side. The MCP at `…/api/mcp` (5 tools) + the AgentKit-signed client
  pattern live in `scripts/m10-acceptance.ts` / `scripts/m8-acceptance.ts`.
- **Reusable IDs unchanged:** app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`. Mac
  Mini `c27f512e-…` (open, action `drop_c27f512e-…`, $10); GeForce RTX 5090 `aafd0d75-…` (open,
  action `drop_aafd0d75-…`, $50). ADMIN_SECRET + WORLD_* + DEMO_* on Railway. nix Chromium for
  screenshots: `nix build nixpkgs#chromium --no-link --print-out-paths` → set `CHROMIUM_BIN`.
  Redeploy: `railway up --ci --service 9f74a937… -m "<msg>"`.
- ⚠️ Carryover gotchas (all still apply): Next 16 route `params` is a Promise; `@/lib/db` is a lazy
  proxy; **build must pass `env -u DATABASE_URL pnpm build`**; Drizzle unique errors on
  `err.cause.code`; tsconfig ES2017 → `BigInt(0)` not `0n`; Railway Metal builder rejects `# syntax=`
  / BuildKit cache mounts; tsx scripts need an async `main()`. Branch: **`build/m11-lifecycle`** (off
  main; nothing merged to main yet — M0–M10 are on `build/m3-admin-plane`).

---

## 2026-06-14 — iter-011 — M13 Live demo tooling + runbook (1:30 / 2h launch + practice harness)
**Status of M13:** ACCEPTED  ·  **🏁 PROJECT COMPLETE (M0–M13 all ACCEPTED).**

**Did:** (new branch `build/m13-demo-tooling` off `build/m11-lifecycle`)
- **`scripts/launch-demo.ts`** — sets the REAL demo timers and opens/draws NOTHING itself (the M11
  ticker honors the clock). Mac Mini → `status=open, opens_at=now, closes_at=now+90s, NO seed`
  (truly random); GeForce RTX 5090 → `status=coming_soon, opens_at=now+2h, closes_at=now+2h+5m`.
  Env-tunable `MAC_MINI_SECONDS` (def 90) / `RTX_HOURS` (def 2) / `RTX_ENTRY_SECONDS` (def 300);
  optional **off-by-default `--seed-human`** stages a guaranteed human win (fixed seed) else null
  seed = CSPRNG. Prints the exact wall-clock open/close times (local + UTC) + live URLs. ✅ It
  correctly sets the RTX row BACK to `coming_soon` (M11 left both drops open) so the launch timer
  shows and the +2h auto-open fires.
- **`scripts/practice-agents.ts`** — OPTIONAL solo-rehearsal harness, explicitly labeled NOT the
  live demo. agent1+agent2 call the **live MCP** `enter_draw(Mac Mini)` with real AgentKit sigs
  (reuses the `m10-acceptance.ts` MCP-client + `buildAgentkitHeader` pattern), waits for the real
  `closes_at` while polling read-only `list_drops` (NEVER calls the admin draw route — the live
  ticker draws), then `check_status` → prints genuine WON/LOST, and the winner calls the `purchase`
  MCP tool → real on-chain USDC settlement from its own wallet. Pre-flight requires the drop OPEN
  with a `closes_at` (errors with a "run launch-demo first" hint otherwise).
- **`scripts/predemo-check.ts`** — updated for the current two-live-drop reality: asserts Mac Mini
  + **GeForce RTX 5090** both EXIST and have a World ID v4 action + Mac Mini fresh-slate (0 entries,
  cleared seed), and **no longer** asserts the stale "Mac Studio coming_soon" status (statuses are
  set by `launch-demo.ts` at demo time). Health/wallet-balance/MCP checks unchanged.
- **`DEMO_RUNBOOK.md`** — rewritten around the REAL live arc: Act1 arm timers (`launch-demo.ts`),
  Act2 presenter scans World ID on their PHONE live, Act3 presenter asks their REAL agents via the
  MCP connector, Act4 the countdown hits zero and the SERVER draws itself (SOLD OUT / YOU WON appear
  on their own), Act5 winner pays real USDC (web on `/win/[id]` or agent via MCP `purchase`). Adds
  the **2h "leave it running" RTX proof**, the practice-harness section (clearly rehearsal-only),
  the `reset-demo` choreography, the M10 automated-rehearsal pointer, and the Track-A traceability.

**Commit:** `28c32cf` (all four files). **No redeploy needed** — these are local tooling that drive
the ALREADY-DEPLOYED M11/M12 app (latest live deployment `2adafed8-…` SUCCESS from M12); the scripts
import existing lib modules and change no app runtime behavior.

**Acceptance test (literal — run against the LIVE Railway URL + chain 4801):**
- **The M13 no-intervention gate** (launch-demo sets timers → NOTHING touches it → autonomous draw):
  - `MAC_MINI_SECONDS=45 pnpm exec tsx scripts/launch-demo.ts` set Mac Mini `closes_at =
    2026-06-14T06:49:27.895Z` (open, no seed) + RTX 5090 `coming_soon, opens_at +2h`.
  - Placed ONE agent entry via the live MCP, then **slept ~75s making NO admin call and NO
    transition-triggering read**. Direct DB read AFTER the wait (via `getDrop`, which does NOT
    trigger transitions): **Mac Mini `status: closed`, `drawnAt: 2026-06-14T06:49:28.721Z`** (~1s
    after `closes_at` — the **background ticker** drew it), the entry → **`won`**. RTX 5090 stayed
    `coming_soon` (opens in 2h) — proving launch-demo staged it from coming_soon and the engine
    honors the future `opens_at`. ⇒ **auto-open + auto-draw at the real clock, zero intervention.**
- **`scripts/practice-agents.ts` runs green against the live MCP** (full agent arc, real settlement):
  ```
  [1] agent1 → ENTERED ; agent2 → ENTERED   (live MCP, real AgentKit sigs)
  [2] waiting for the real closes_at — the server's ticker draws itself …  drop is now "closed".
  [3] agent1 → WON ; agent2 → LOST          (truly random, no seed)
  [4] agent1 WON — ✓ PURCHASED — 10 USDC on chain 4801
      tx: 0x8bf6a28e25a51be10cfb79382a33ff48f71d72c798c3f29bdd65c1ee81c6e5a4
  ```
  Receipt independently verified: `eth_getTransactionReceipt` → `status 0x1` (success), block
  **30436131**, `from 0x8baf91…754a7` (= agent1's own wallet — the winning agent settled from its
  registered wallet). Explorer:
  https://sepolia.worldscan.org/tx/0x8bf6a28e25a51be10cfb79382a33ff48f71d72c798c3f29bdd65c1ee81c6e5a4
- **`scripts/predemo-check.ts` → ✅ ALL GREEN** (app/db health, human 24 / agent2 10 / agent1 86
  USDC + gas, both drops exist with World ID actions, Mac Mini fresh-slate 0 entries / seed clear,
  MCP advertises all 5 tools).
- **Build/typecheck:** `pnpm typecheck` → exit 0; **`env -u DATABASE_URL pnpm build`** → exit 0,
  "Compiled successfully" (instrumentation no-ops at build; `/win/[entryId]` in the route list).
- **Left clean for the demo/next run:** `reset-demo` ran; live `GET /api/drops` → Mac Mini open /
  RTX 5090 open, both `closesAt=null`, `drawSeed=null`, Mac Mini 0 entries.

**Deviations from PRD:** none material.
- predemo-check's drop-status assertion was relaxed (existence + action + fresh slate) since
  `launch-demo.ts` now owns the statuses at demo time — the M10-era "Mac Studio coming_soon" check
  was stale (the 2nd drop is now the live GeForce RTX 5090). Obviously correct given M11/M12.
- `--seed-human` sets a fixed seed; with the usual "human enters first / is the sole real entrant"
  flow that guarantees the win. If multiple entrants exist before the draw, a fixed seed makes the
  draw deterministic but not necessarily the human (matches how the M6/M10 seeded mechanism works —
  the runbook notes "make the intended winner the first/sole real entrant").

**Definition of Done (PRD §5) — all boxes now satisfied:**
- M0–M13 acceptance tests all pass + recorded here. ✅
- Live Railway URL runs the full demo + resets cleanly (M10 + M13 reset-demo). ✅
- ≥2 real World Chain Sepolia USDC settlement txs captured — many across M5/M6/M8/M9/M10/M11/M12,
  plus this M13 agent settlement (one web, one agent both well covered). ✅
- One-slot-per-human enforced + demonstrably blocks dupes on both surfaces (M4 web / M7 agent). ✅
- `DEMO_RUNBOOK.md` lets a human re-run from cold in <5 min (checklist → launch-demo → 5 acts). ✅
- No provisioned cloud resource ever deleted (only rows/state cleared). ✅
- Timers genuinely time-driven (M11) — proven again by the M13 no-intervention gate above. ✅
- Launch + entry countdowns, SOLD OUT, `/win/[entryId]` winner page live with real purchase (M12);
  winner-page screenshot committed (`docs/screenshots/m12-winner.png`). ✅
- Live demo tooling (M13): `launch-demo.ts` sets the 1:30/2h timers and opens/draws nothing itself;
  `DEMO_RUNBOOK.md` centers on the real live flow; `practice-agents.ts` runs green. ✅

**NOTES FOR NEXT ITERATION:** **None — the project is COMPLETE.** Every milestone M0–M13 is ACCEPTED
and the full Definition of Done is met. No work remains for the loop. (If a human wants to merge:
nothing is on `main` yet — M0–M10 live on `build/m3-admin-plane`, M11/M12 on `build/m11-lifecycle`,
M13 on `build/m13-demo-tooling` which is stacked on m11-lifecycle. The live Railway deployment
already serves the full M0–M13 app.)
- **Demo-day quickstart:** `predemo-check.ts` (all-green) → `launch-demo.ts` → narrate the 5 acts in
  `DEMO_RUNBOOK.md`. Solo rehearsal of the agent side: `practice-agents.ts` (after a short
  `MAC_MINI_SECONDS` launch-demo). Reset between runs: Admin **⟳ RESET DEMO** or the reset-demo curl.
- **Reusable IDs unchanged:** app service `9f74a937-4034-4767-8fd0-67115833c31d`, Postgres
  `5a9197a2-96c1-44d2-9305-dbbb3204cbc1`, live `https://worldcoinapp-production.up.railway.app`. Mac
  Mini `c27f512e-…` ($10, action `drop_c27f512e-…`); GeForce RTX 5090 `aafd0d75-…` ($50, action
  `drop_aafd0d75-…`). ADMIN_SECRET + WORLD_* + DEMO_* on Railway.
