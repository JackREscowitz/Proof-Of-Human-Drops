# PROGRESS.md — build-loop ledger

> The Ralph loop's only cross-iteration memory. **Append** one entry per iteration
> (never rewrite history). Stamp the milestone id (e.g. `M3`) in every entry. When a
> milestone passes its Acceptance Test, mark `Status of M<N>: ACCEPTED` — the next
> iteration skips it without re-testing. Never put secrets (private keys, DB passwords)
> here; reference them by file/name only. Format spec: `RALPH_GUIDE.md` §12.

## Milestone status at a glance
- **M0 — Repo & toolchain bootstrap:** ACCEPTED
- M1 — Railway connectivity + Docker deploy (Railway CLI): not started
- M2 — DB schema + migrations (Drizzle + Railway Postgres): not started
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
