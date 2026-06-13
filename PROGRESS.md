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
- M3 — Drop/variant domain + admin/reset plane: not started
- M4 — World ID v4 verify + per-drop dedupe (web): not started
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
