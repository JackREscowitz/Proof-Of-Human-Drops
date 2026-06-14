# PRD — Proof-of-Human Drops
## A bot-proof scarce-goods drop platform for ETH Global NYC 2026 (World Track A / AgentKit)

> **Read first:** [`RESEARCH_REPORT.md`](./RESEARCH_REPORT.md) for the product thesis, pitch, and verified research. **Read [`RALPH_GUIDE.md`](./RALPH_GUIDE.md) before doing anything** — it contains the operating rules, resource files, environment facts, and hard constraints for the build loop. This PRD is the *what to build, in what order, and how to prove each step is done*.

---

## 0. Ground truth (verified 2026-06-13 — these OVERRIDE the research report where they differ)

The research report (`RESEARCH_REPORT.md`) was written before resources were provisioned. The following facts were verified live against the World Developer Portal MCP, the provisioned wallets, and the toolchain. **Where this section and the research report disagree, this section wins.**

| Fact | Verified value | Note |
|---|---|---|
| **World ID app** | `app_1f62e669c5b6b7ec0b22ee9fcb295a0a` ("ETH GLOBAL 2026") | `engine: cloud`, `status: active` |
| **World ID version** | **v4 (managed RP)** — NOT v3 | RP `rp_8a9bfc2fcfa0ada9`, `mode: managed`, `status: registered`. Report's "use v3 to dodge v4 risk" is **moot** — the app is already a registered v4 cloud RP. **Target v4.** |
| **Verify endpoint** | `POST https://developer.world.org/api/v4/verify/rp_8a9bfc2fcfa0ada9` | Also `proof-context` and `rp-status` endpoints under the same `rp_id` |
| **RP signer address** | `0x22F2Fb02D1f631C71e9Aca6939a0D74315442821` | On-chain registered signer |
| **v4 actions** | `actions_v4: []` (none yet) | Loop must create one action per drop (or use a documented dynamic-action pattern) via the World MCP / portal |
| **World Chain Sepolia chain ID** | **`4801`** — NOT `480` | `480` is **mainnet**. The report said `480`; that was wrong for testnet. Use **`4801`** for the demo. |
| **RPC** | `https://worldchain-sepolia.g.alchemy.com/public` | Public Alchemy endpoint (no key) — fine for the demo |
| **Explorer** | `https://sepolia.worldscan.org` | For tx-hash links in the demo |
| **USDC (testnet)** | `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` | **Bridged USDC.e**, 6 decimals. `$10 = 10000000` raw |
| **Railway project** | **`worldcoin_app`** — id `c3751ac9-2806-4e9e-83d7-30504b6a059f`, env `production` (`928cd32e-b60e-43b3-86f7-2c7bbcb9476d`) | **Already exists — M1 LINKS to it, never creates a new project.** No services yet (M1 adds the app service, M2 adds Postgres). Workspace "Carson Weeks's Projects" |
| **DB** | Railway Postgres (provisioned in the project above via `railway add --database postgres`) | Railway injects `DATABASE_URL` as a service variable; pull it with `railway variables`. Use the private-network URL inside Railway and the public proxy URL for local runs |
| **Toolchain present** | Node v22.20, pnpm 10.18, npm 11.6, Docker 28.4 | Railway CLI **installed (5.12.1) and authenticated** as `carson@taho.is`. **All** Railway operations go through the CLI via the `use-railway` skill (deploy, DB provisioning, variables, domains, status) |
| **Wallets** | 1 agent wallet in `secret_keys`; 3 demo wallets (Agent 1, Agent 2, Human) in `demo_wallets.md` | All testnet. Fund per `demo_wallets.md` checklist |

**Two architecture decisions locked for the build (from the report's open questions):**
- **MCP auth = Option A (native AgentKit per-request signature) as the primary path**, with a server-minted session token (Option B) permitted *only* as an ergonomic cache that maps 1:1 to a verified `humanId`. There is **no AgentKit "delegated bearer token" primitive** — do not write code that asks AgentKit for one.
- **Effect-ts is DROPPED.** Use plain TypeScript service modules (async/await) per `RALPH_GUIDE.md` §"Stack". Drizzle + Next.js + viem stay. This removes the #1 schedule risk; the architecture is identical.

---

## 1. Product summary (one paragraph)

A drops storefront where scarce stock (a Mac Mini, instant-sellout) is allocated **1 slot per verified human per drop**, enforced by a World ID v4 nullifier. Two entry points hit one backend: a **Next.js web app** for humans (verify → enter draw → if drawn, pay USDC) and a **remote MCP server** so a human's AI agent (Claude/ChatGPT) can do the same on their behalf, carrying AgentKit proof-of-human. At drop close a fair random draw picks winners; the winner settles a **real USDC transfer on World Chain Sepolia (chain 4801)**. An admin/reset plane lets us re-run the whole thing live for judges.

**Scope & shape:** This is **not** a full-featured e-commerce store. It's a small, curated **drop showcase** — a handful of featured products at a time (the demo: one live Mac Mini drop + one "coming soon" item). Think SNKRS / Balenciaga-campaign / a featured-drops landing page, not a catalog with search, carts, accounts, or checkout flows. Keep surface area small and the visual impact high. **Design direction: pop-brutalist** (see M9 and `RALPH_GUIDE.md` §11 — reference images live in `webinspo/`).

---

## 2. How to use this PRD (Ralph loop contract)

- **Milestones are strictly ordered. Each depends on the previous.** Do not start milestone N+1 until milestone N's **Acceptance Test** passes and its **Exit Criteria** checkboxes are all checked.
- Each milestone is: **Goal → Build steps → Verification steps → Acceptance Test → Exit Criteria**.
- **Verification steps** are things you run to confirm wiring (commands, curls). **Acceptance Test** is the single objective pass/fail gate for the milestone.
- Record progress in `PROGRESS.md` (create it in M0). After each milestone, append a dated entry: what was built, the acceptance-test output, and any deviations. **This is the loop's memory across runs** — read it at the start of every run.
- If a milestone is blocked by something the loop genuinely cannot do (e.g. a faucet rate-limit, a human-only OAuth click), write the blocker to `PROGRESS.md` under a `## BLOCKED` heading with the exact action needed, and move to any *independent* sub-task; do not spin.
- **You may freely:** clear/reset the database (drop & recreate tables, wipe rows), deploy to Railway, and spend the testnet USDC/ETH in the demo wallets — the user has authorized all of this. **The one thing to avoid is destroying the *provisioning* itself**: don't delete the Railway project/service, the Railway Postgres database service, or the World app/RP (those are slow to recreate and may need human re-auth). Tables and data inside the DB are fair game. See `RALPH_GUIDE.md` §"Hard constraints".
- Keep secrets out of git. `secret_keys`, `demo_wallets.md`, `.env*` are gitignored — keep it that way.

---

## 3. Milestones

Each milestone is sized to be completable and verifiable in one or a few loop iterations. The dependency chain is: **M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10** — then the post-completion extension milestones **M10 → M11 → M12 → M13** (see §3b).

---

### M0 — Repo & toolchain bootstrap
**Depends on:** nothing (first milestone).
**Goal:** A committed Next.js + TypeScript app skeleton that builds and runs locally, with the progress ledger established.

**Build steps**
1. Create `PROGRESS.md` with a header and an empty log; append the M0 entry at the end of this milestone.
2. Scaffold Next.js (App Router) + TypeScript in-place: `pnpm dlx create-next-app@latest . --ts --app --eslint --tailwind --src-dir --use-pnpm` (resolve the "directory not empty" prompt by scaffolding into a temp dir and merging, taking care not to clobber `RESEARCH_REPORT.md`, `PRD.md`, `RALPH_GUIDE.md`, `secret_keys`, `demo_wallets.md`, `.mcp.json`, `.gitignore`, `webinspo/`). **Use Tailwind**, and initialize **shadcn/ui** (`pnpm dlx shadcn@latest init`) so the component primitives are ready when the UI lands in M9. You may pull individual shadcn components as needed (`shadcn add button card ...`).
3. Set `output: 'standalone'` in `next.config.js` (needed for the Docker image in M1).
4. Add a root `tsconfig` strict mode, a `package.json` `scripts` block with `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), and `db:*` placeholders.
5. Add a `/` page that renders "Proof-of-Human Drops" and a `/api/health` route returning `{ ok: true }`.
6. Commit on a feature branch (never commit straight to `main` per global rules) — branch `build/m0-bootstrap`.

**Verification steps**
- `pnpm install` exits 0.
- `pnpm typecheck` exits 0.
- `pnpm build` produces `.next/standalone`.
- `pnpm dev` then `curl -s localhost:3000/api/health` → `{"ok":true}`.

**Acceptance Test**
- `pnpm build` succeeds AND `curl localhost:3000/api/health` returns `{"ok":true}` from the production (`pnpm start`) server.

**Exit Criteria**
- [ ] `PROGRESS.md` exists with an M0 entry.
- [ ] App builds in standalone mode and health endpoint passes against `pnpm start`.
- [ ] No secret files were committed (run `git status` — `secret_keys`/`demo_wallets.md` must be untracked/ignored).

---

### M1 — Railway connectivity + Docker deploy of the skeleton
**Depends on:** M0.
**Goal:** Prove we can deploy this repo to Railway as a Dockerfile and reach the live health endpoint. **Deploy is allowed; deleting existing resources is not.**

**All Railway operations in this project go through the `railway` CLI** (install, auth, link, deploy, DB provisioning, variables, domains, status). Prefer `--json` output for parsing. Do not use the dashboard or raw API except where the CLI genuinely can't do it.

**Build steps**
1. The Railway CLI is **already installed (5.12.1) and authenticated** (`carson@taho.is`). Confirm with `railway whoami --json`. If for some reason it's missing/logged-out, install via `npm i -g @railway/cli` and run `railway login`; if a sign-in link prints and can't be completed, relay it and write `PROGRESS.md` `## BLOCKED`, then pause.
2. Write a multi-stage `Dockerfile` for Next standalone: build stage (`pnpm install --frozen-lockfile`, `pnpm build`), runtime stage copying `.next/standalone`, `.next/static`, `public`; `CMD ["node","server.js"]`; expose `3000`; respect `PORT`.
3. Add `.dockerignore` (node_modules, .next, .git, secret files).
4. **Link to the existing project** `worldcoin_app` — **do NOT create a new one**: `railway link --project c3751ac9-2806-4e9e-83d7-30504b6a059f --environment production`. It currently has no services; add the app service for this repo (`railway add --service <name> --json`) or let `railway up` create it. (Verify with `railway status --json` / `railway service list --json` first.)
5. Set the service to build from the Dockerfile. Deploy with `railway up` (use `railway up --detach` for scripted runs, then poll `railway deployment list --json` until the newest deployment is `SUCCESS` — never report a deploy done before observing terminal `SUCCESS`).
6. Generate/confirm the public domain with `railway domain`.

**Verification steps**
- `railway whoami --json` succeeds.
- `railway status --json` shows the linked project/service.
- `docker build .` succeeds locally (catch image errors before pushing).
- `railway deployment list --json` shows the newest deployment `SUCCESS`.
- After deploy: `curl -s https://<railway-domain>/api/health` → `{"ok":true}`.

**Acceptance Test**
- The Railway-hosted URL returns `{"ok":true}` from `/api/health`.

**Exit Criteria**
- [ ] Railway project + service linked via `railway link` (IDs recorded in `PROGRESS.md`).
- [ ] Live Railway URL serves the health endpoint (deploy confirmed `SUCCESS` via `railway deployment list`).
- [ ] Dockerfile + .dockerignore committed.
- [ ] No pre-existing Railway resources were deleted (additive only).

---

### M2 — Database, schema, and migrations (Drizzle + Railway Postgres)
**Depends on:** M1.
**Goal:** All tables from the data model live in Railway Postgres via Drizzle migrations, reachable from both local and the Railway app service.

**Build steps**
1. Provision a Railway Postgres database in the project with the CLI: `railway add --database postgres --json` (check `railway service list --json` first — **never recreate** if one already exists). Record the DB service name/ID in `PROGRESS.md`.
2. Add `drizzle-orm`, `drizzle-kit`, and a Postgres driver (`postgres` / `pg`). Railway Postgres provides `DATABASE_URL` automatically as a service variable — no manual host/port/user assembly and no `sslmode=require` ceremony.
3. Wire `DATABASE_URL` in both contexts:
   - **App service (on Railway):** reference the DB's private-network URL. Railway exposes it as `DATABASE_URL`; if the app and DB are separate services, set it as a reference variable on the app service (`railway variables --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}'`) so traffic stays on the private network.
   - **Local dev:** pull the public proxy connection string with `railway variables --json` (the `DATABASE_PUBLIC_URL`) into `.env`. **Never commit it** — `.env*` stays gitignored.
4. Implement the schema from `RESEARCH_REPORT.md` §4: `drops`, `variants`, `entries`, `agents`, `sessions`, `orders`. Critical constraints:
   - `entries`: `UNIQUE (drop_id, human_key)` — **the Sybil guarantee**.
   - `nullifier_hash` stored as `NUMERIC(78,0)` (or text) — exceeds bigint.
   - `price_usdc` / `amount_usdc` as `NUMERIC(20,6)`.
   - status enums per the report.
5. Generate and apply migrations (`drizzle-kit generate` + a migrate runner). Add `db:generate`, `db:migrate`, `db:studio` scripts. Run migrations against Railway either locally via the public URL or with `railway run pnpm db:migrate` (injects the service `DATABASE_URL`).
6. Add `/api/health/db` that does `SELECT 1` and returns `{ db: "ok" }`.

**Verification steps**
- `pnpm db:migrate` (or `railway run pnpm db:migrate`) applies cleanly against Railway Postgres.
- Connect (psql or drizzle studio) and confirm all 6 tables + the `UNIQUE(drop_id, human_key)` index exist.
- `curl localhost:3000/api/health/db` → `{"db":"ok"}`.
- After redeploy, the Railway URL's `/api/health/db` also returns ok (proves the app service reaches Railway Postgres over the private network).

**Acceptance Test**
- Inserting two rows into `entries` with the same `(drop_id, human_key)` **fails** with a unique-constraint violation; with different `human_key` it **succeeds**. (Write this as a throwaway script or a test.)

**Exit Criteria**
- [ ] All 6 tables migrated to Railway Postgres.
- [ ] `UNIQUE(drop_id, human_key)` enforced (proven by the acceptance test).
- [ ] Both local and the Railway app service reach the DB (`/api/health/db` green in both).

---

### M3 — Drop & variant domain + admin/reset control plane
**Depends on:** M2.
**Goal:** CRUD + lifecycle for drops/variants, plus the **admin/reset plane** the live demo depends on. Build this early — every later milestone is demoed through it.

**Build steps**
1. Service module `drops.service.ts` (plain TS, no Effect): create drop, add variants, transition status (`coming_soon → open → closed → settled`), reset drop.
2. Admin API routes under `/api/admin/*`, gated by `ADMIN_SECRET` (header or query). Endpoints: create/open/close/settle drop, set/get RNG seed, **reset drop** (truncate `entries`+`orders` for that `drop_id`, set status `open`, reset countdown), flip second item `coming_soon ↔ open`, force-trigger draw (used in M6).
3. Seed script that creates the demo state: a "Mac Mini" drop (variants Silver/Black, `total_slots=1`, `price_usdc=10`, status `open`) and a "coming soon" second item (e.g. "Mac Studio") with variants.
4. A minimal admin page (`/admin`) behind the secret with buttons for the above (can be ugly — it's an operator console).

**Verification steps**
- `POST /api/admin/seed` (or run the seed script) creates the two items; `GET /api/drops` lists them with correct statuses/variants.
- `POST /api/admin/drops/:id/reset` empties entries/orders for that drop and returns it to `open`.
- Admin routes reject calls without `ADMIN_SECRET` (401).

**Acceptance Test**
- Full lifecycle via admin API: create drop → open → (insert a dummy entry) → reset → confirm `entries` for that drop is empty and status is `open` again. All steps return 2xx and the DB reflects each transition.

**Exit Criteria**
- [ ] Drops/variants CRUD + lifecycle works.
- [ ] Reset truncates entries/orders for a drop and re-opens it.
- [ ] Admin plane is auth-gated.
- [ ] Seed produces the Mac Mini drop + the coming-soon item.

---

### M4 — World ID v4 verification + per-drop nullifier dedupe (web path)
**Depends on:** M3.
**Goal:** A human can verify with World ID v4 on the web and enter a drop; the same human cannot enter the same drop twice. **This is the core Sybil guarantee.**

**Build steps**
1. Create the World ID **action(s)** for the drop. Either one action per drop (`drop_<id>`) created via the World Developer Portal MCP (`actions_v4` is currently empty), or a documented dynamic-action approach — pick one and record it in `PROGRESS.md`. Action scoping is what makes "one slot **per drop**" work while letting a human enter *different* drops.
2. Web: add the IDKit widget (`@worldcoin/idkit`) to the drop page, configured for app `app_1f62e669c5b6b7ec0b22ee9fcb295a0a`, the drop's action, and a signal (bind the chosen variant or a user ref).
3. Backend verify route: call the **v4 verify endpoint** `POST https://developer.world.org/api/v4/verify/rp_8a9bfc2fcfa0ada9` (NOT v3 `verifyCloudProof` — this app is a v4 RP). Handle the v4 proof shape (5 hex elements; `nullifier` + `signal_hash`). Use `WORLD_MCP_API_KEY` / signer per `secret_keys` as required by the endpoint.
4. On successful verify, insert into `entries` with `human_key = nullifier`, `source='web'`. Rely on `UNIQUE(drop_id, human_key)` to reject duplicates; map the DB violation to a friendly "you're already entered" response.
5. UI states: not-entered / verifying / entered / already-entered.

**Verification steps**
- Verify flow completes end-to-end in a browser against a real World ID proof (World App). If a real proof can't be produced headlessly, the loop documents the manual verification step in `PROGRESS.md` and provides a scripted path that posts a captured proof fixture to the verify route.
- Entering twice with the same World ID → second attempt returns "already entered" and **no** second row appears.
- Entering the *same* World ID in a *different* drop → succeeds (proves per-drop action scoping).

**Acceptance Test**
- A valid v4 proof creates exactly one `entries` row for `(drop_id, nullifier)`; a replay of the same human against the same drop is rejected with no new row; the same human against a different drop is accepted.

**Exit Criteria**
- [ ] v4 verify endpoint integrated (correct `rp_id`, proof shape).
- [ ] One-slot-per-human-per-drop enforced and demonstrated.
- [ ] Cross-drop entry by the same human works (action scoping correct).

---

### M5 — USDC settlement on World Chain Sepolia (viem)
**Depends on:** M4.
**Goal:** The platform can execute a real USDC transfer on chain 4801 and record the tx in `orders`. Tested independently of the draw so the money path is proven before it's wired to a winner.

**Build steps**
1. Add `viem`. Configure a chain object for World Chain Sepolia: **chain id `4801`**, RPC `https://worldchain-sepolia.g.alchemy.com/public`, explorer `https://sepolia.worldscan.org`.
2. `settlement.service.ts`: build + send an ERC-20 `transfer` on USDC `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` (6 decimals; `$10 = 10000000`). Sign with a wallet private key from the resource files (agent wallet from `secret_keys`, or the demo wallets in `demo_wallets.md`). Wait for the receipt; store `tx_hash` + status in `orders`.
3. A guarded admin/test route `/api/admin/test-transfer` that sends a tiny USDC amount between two demo wallets and returns the tx hash — used to prove the money path without a full draw.
4. Pre-flight checks: read sender USDC balance and native ETH (gas) balance; if insufficient, return a clear "fund via faucet" error referencing `demo_wallets.md`'s faucet links.

**Verification steps**
- `GET` a balance endpoint shows the funded wallets' USDC + ETH.
- `POST /api/admin/test-transfer` returns a tx hash that confirms on `https://sepolia.worldscan.org`.
- The `orders` row records `tx_hash` and `status='confirmed'` after the receipt.

**Acceptance Test**
- A real USDC transfer of 10 USDC (`10000000` raw) between two funded demo wallets confirms on World Chain Sepolia and is recorded in `orders` with a verifiable explorer link. (If faucets are dry, this is the one acceptable place to BLOCK and request funding — write it to `PROGRESS.md`.)

**Exit Criteria**
- [ ] Correct chain (4801), USDC address, and 6-decimal math.
- [ ] A real on-chain USDC transfer confirms and is persisted.
- [ ] Gas/balance pre-flight gives actionable errors when unfunded.

---

### M6 — Fair draw engine + winner → purchase window
**Depends on:** M5.
**Goal:** At drop close, pick winners uniformly at random from unique entries; a winner gets a bounded purchase window that, when exercised, triggers the M5 settlement. **Seedable for deterministic demo wins.**

**Build steps**
1. `draw.service.ts`: at `closes_at` (or admin force-trigger), select `total_slots` winners uniformly at random from `entries` where `status='pending'` for the drop. Mark winners `won`, others `lost`.
2. **Seedable RNG**: the drop's admin-set seed (from M3) determines the winner deterministically, so judges can watch a staged human win. Without a seed, use a real CSPRNG.
3. Winner purchase window: a `won` entry can call `purchase` within the window → invokes `settlement.service` (M5) for `price_usdc` to the merchant/receiver → creates `orders` row → on confirmation sets entry `purchased`. Expired window → `expired`.
4. Wire admin "force draw" to run the draw immediately (no waiting for a real countdown in the demo).

**Verification steps**
- Seed the drop, add N dummy entries, force draw → the deterministic expected winner is `won`, rest `lost`.
- Winner exercises purchase → real USDC tx (M5) confirms → entry `purchased`, `orders` updated.
- A `lost` or non-winning entry attempting purchase is rejected.

**Acceptance Test**
- With a fixed seed and a known entry set, the draw produces the exact expected winner every run; that winner completes a real USDC purchase on chain 4801 and ends in `purchased`; non-winners cannot purchase.

**Exit Criteria**
- [ ] Uniform random draw over unique entries; correct winner count.
- [ ] Deterministic with a seed (demo-stageable).
- [ ] Winner purchase triggers real settlement; non-winners blocked.

---

### M7 — MCP server: informational + entry tools (AgentKit auth)
**Depends on:** M6.
**Goal:** A remote MCP server exposing shopping tools, with **AgentKit native per-request auth (Option A)** resolving each call to a `humanId`, enforcing the *same* per-drop uniqueness as the web path.

**Build steps**
1. Stand up an MCP server with `@modelcontextprotocol/sdk` over **streamable-HTTP** (remote transport so Claude/ChatGPT can add it as a custom connector). Mount it in the Next app (route handler) or as a sibling process on Railway — pick one, record it.
2. AgentKit auth middleware (Option A): on each tool call, expect the AgentKit x402-style signed CAIP-122 header; `verifyAgentkitSignature()` to recover the wallet, then `createAgentBookVerifier()` to resolve the wallet → anonymous `humanId` on World Chain. Reject calls without a valid signature with a 402 challenge. (Optionally mint a short-lived session row in `sessions` mapping token→`humanId` as an ergonomic cache — Option B as a *cache only*, never as the source of truth.)
3. Tools:
   - `list_drops` — open + coming-soon drops with variants/prices/timers.
   - `get_drop_info(drop_id)` — the "coming soon: when does it drop, what variants" informational tool.
   - `enter_draw(drop_id, variant)` — verify human via AgentKit, insert entry with `human_key = humanId`, `source='agent'`; same `UNIQUE(drop_id, human_key)` dedupe.
   - `check_status(drop_id)` — this human's entry status.
4. Ensure web `nullifier` and agent `humanId` both populate `human_key` so a person can't double-enter across surfaces (document the mapping; if World ID nullifier and AgentBook humanId are different namespaces, dedupe within each surface and note the cross-surface caveat honestly in `PROGRESS.md` + the demo).

**Verification steps**
- An MCP client (or a scripted client) lists drops and gets coming-soon info.
- `enter_draw` with a valid AgentKit signature creates an `entries` row with `source='agent'`; without a valid signature it's rejected (402).
- Same human-backed agent entering twice → rejected; distinct agents of the *same* human → still one slot (humanId dedupe).

**Acceptance Test**
- Via MCP, a human-backed agent: (a) lists drops, (b) reads coming-soon info, (c) enters the Mac Mini draw once, (d) is rejected on a second entry for the same human — all with AgentKit signature verification gating the privileged calls.

**Exit Criteria**
- [ ] Remote MCP server reachable; tools registered.
- [ ] AgentKit per-request auth resolves `humanId`; unsigned calls rejected.
- [ ] Agent entry enforces one-slot-per-human; informational tool works.

---

### M8 — MCP purchase tool + end-to-end agent settlement
**Depends on:** M7.
**Goal:** A human-backed agent that wins can purchase via MCP, settling real USDC from its registered wallet.

**Build steps**
1. `purchase(drop_id)` MCP tool: only valid for a `won` entry within its window; invokes M6 purchase → M5 settlement using the agent's registered wallet; returns the tx hash + explorer link.
2. AgentBook registration helper/docs: the demo agent wallets (`demo_wallets.md` Agent 1 / Agent 2) must be registered in AgentBook backed by distinct World IDs. Provide a script or documented steps; if registration requires a human-only step, write it to `PROGRESS.md` BLOCKED with exact instructions.
3. End-to-end agent path test harness (scripted MCP client): list → enter → (admin force draw, seeded to this agent) → purchase → confirm tx.

**Verification steps**
- Seeded draw makes the agent the winner; `purchase` returns a tx hash confirmed on `sepolia.worldscan.org`; entry → `purchased`, `orders` recorded.
- A non-winning agent calling `purchase` is rejected.

**Acceptance Test**
- Full agent journey through MCP only: enter → win (seeded) → purchase → **real USDC tx on chain 4801 confirmed** → entry `purchased`. Reproducible after an admin reset.

**Exit Criteria**
- [ ] Agent can complete a real purchase via MCP.
- [ ] Settlement uses the agent's registered wallet; tx verifiable.
- [ ] Reproducible post-reset for repeated demos.

---

### M9 — Web purchase UI + pop-brutalist design pass + cross-surface consistency
**Depends on:** M8.
**Goal:** The human web path reaches feature parity with the agent path AND looks the part: a small, high-impact **pop-brutalist drop showcase**. A web winner can pay in-browser; the UI tells the whole story; both surfaces share one backend truth.

**Design direction (study `webinspo/` first — image.png, image2.png, image3.png, image4.png):**
- **Pop-brutalist.** Bold oversized display type, hard edges, **thick black borders/outlines**, blocky cards with chunky hard (or solid offset) shadows, no soft gradients-as-decoration.
- **Canvas:** off-white/cream (à la the Sui Overflow ref) or high-contrast black (the Seal ref) — pick one primary canvas and commit. A subtle blue/black **grid background** is on-brand.
- **Accent:** one electric pop color — **acid/lime green** (Balenciaga + Seal refs) as the primary action/highlight, optionally a second primary pop (orange/purple/blue) used sparingly for variant chips or stickers.
- **Layout:** editorial **drop-campaign** feel (Balenciaga ref) — huge heading, generous whitespace, a small grid of featured product cards. This is a *showcase of a few items*, not a catalog. No search, cart, or account UI.
- **Components:** build on **shadcn/ui + Tailwind**, restyled to the brutalist look (square corners, 2px+ black borders, hard shadows, big bold buttons with arrow glyphs like the refs). Keep it cohesive, not busy.

**Build steps**
1. Web winner flow: a `won` web entry sees a "YOU WON — PURCHASE" CTA that triggers settlement (wallet connect via the human demo wallet, or a server-side settle for demo simplicity — pick the simplest convincing path and record it).
2. Drop showcase landing: hero drop-campaign heading, featured product card(s) for the live Mac Mini drop + the coming-soon item, countdown, variant picker (Silver/Black) as brutalist chips, entry status, winner banner, "ALREADY ENTERED" state.
3. A small **"fairness" panel** (styled as a bold stat block) showing total unique humans entered and that duplicates were blocked — the visible proof of the Sybil guarantee for judges.
4. Apply the pop-brutalist theme globally (Tailwind theme tokens: fonts, the accent color, border width, shadow style) so it's consistent across pages including `/admin`.
5. Confirm web + agent entries to the same drop both honor uniqueness and both appear in the operator/admin view.

**Verification steps**
- A web human enters, is force-drawn (seeded), purchases → real USDC tx confirmed → UI shows success + explorer link.
- Admin view shows both web and agent entries for a drop with correct sources.
- The landing page visibly matches the pop-brutalist direction (bold type, black borders, accent pop, grid/campaign layout) — capture a screenshot in `PROGRESS.md`.

**Acceptance Test**
- A human, entirely via the web UI, enters → wins (seeded) → pays USDC on chain 4801 (confirmed) → sees a success state. The same drop also shows an agent-sourced entry, the duplicate-block is visible, and the page is styled in the cohesive pop-brutalist look (screenshot attached to `PROGRESS.md`).

**Exit Criteria**
- [ ] Web purchase works end-to-end with a real tx.
- [ ] UI communicates entry/draw/win/purchase + coming-soon clearly.
- [ ] Web and agent entries coexist correctly under one uniqueness rule.
- [ ] Cohesive pop-brutalist theme applied (shadcn + Tailwind), matching `webinspo/` references; screenshot recorded.

---

### M10 — Demo hardening, reset choreography & dry run
**Depends on:** M9.
**Goal:** The full judge demo (per `RESEARCH_REPORT.md` §9) runs start-to-finish on the live Railway URL, resets cleanly between runs, and is documented as a runbook.

**Build steps**
1. `DEMO_RUNBOOK.md`: the 5-act script (§9 of the report) with exact clicks/commands, the seed value that makes the intended winner win, and the **reset choreography** (reset drop, re-confirm wallet balances, re-set seed, flip the coming-soon item).
2. One-command (or one-page-button) **reset-to-demo-start** that returns the whole system to Act-1 state.
3. Pre-demo checklist script: verifies wallet USDC+ETH balances, drop statuses, seed, MCP reachability, World ID action existence — prints a green/red board.
4. Full rehearsal: run all 5 acts on the live Railway deployment twice in a row, resetting between, capturing the two real tx hashes.

**Verification steps**
- The pre-demo checklist prints all-green.
- Two consecutive full runs (with reset between) each end in a confirmed on-chain purchase.

**Acceptance Test**
- On the **live Railway URL**, the complete demo (web double-entry block → agent enters via MCP → seeded draw → real USDC settlement with explorer link → coming-soon query via MCP) runs twice back-to-back with a clean reset between, no manual DB surgery.

**Exit Criteria**
- [ ] `DEMO_RUNBOOK.md` + reset button + checklist exist and work.
- [ ] Two clean back-to-back live runs captured (tx hashes in `PROGRESS.md`).
- [ ] Maps explicitly to the 3 qualification requirements (note in the runbook which act proves which requirement).

---

## 3b. Post-completion extension milestones (M11–M13)

> Added after the M0–M10 project was completed and accepted. These make the drop **timers
> genuinely time-driven by the server's own clock — no smoke and mirrors.** Set a drop to launch
> in 1:30 and walk away: the server opens entries and runs the draw when the clock hits zero, with
> the browser closed and nothing nudging it. Wait the full 2h for the NVIDIA raffle and it really
> opens and really draws. On-chain settlement is real USDC on chain 4801.
>
> **The World ID scan and the agent calls are performed LIVE, by a human, in front of the judges**
> — that is the product, not something to automate. The demo scripts only (a) set the real
> timestamps and (b) provide an *optional* solo-practice harness for the agent side; they never
> fake the human or the agents in the real demo.
>
> Dependency chain continues: **M10 → M11 → M12 → M13.** Build order stays strict.

---

### M11 — Real time-driven lifecycle (autonomous open + draw)
**Depends on:** M10.
**Goal:** Drops transition on the real clock with zero intervention — `coming_soon → open` when
`opensAt` passes, and `open → closed` **with the draw actually running** when `closesAt` passes.
The winner is **truly random (CSPRNG, no seed)** over whoever actually entered. The same draw,
settlement, and dedupe code proven in M6/M8/M9 is reused verbatim — only the *trigger* changes
from an admin call to the wall clock.

**Build steps**
1. `lib/lifecycle.service.ts` → `applyDueTransitions()`:
   - For each drop: `coming_soon` with `opens_at <= now` → flip to `open`.
   - `open` with `closes_at != null` and `closes_at <= now` → run `runDraw(dropId)` (the existing
     M6 path: marks `closed`, picks a CSPRNG winner, opens the purchase window).
   - **Atomic draw guard** so the ticker and a concurrent read can't double-draw: a conditional
     update (`SET drawn_at = now() WHERE id = ? AND status = 'open' AND drawn_at IS NULL`) elects
     exactly one caller to perform the draw; everyone else no-ops.
   - A `dropTiming(drop)` helper returning `{ phase, opensAt, closesAt, secondsUntilOpen,
     secondsUntilClose }` for the UI (M12).
2. **Lazy trigger (on read):** call `applyDueTransitions()` at the top of `listDrops()` and the
   single-drop read behind `/api/drops/:id/entry-status`, so any page load or poll reflects the
   true current state.
3. **Autonomous trigger (background ticker):** add `instrumentation.ts` at the repo root exporting
   `register()` (Next 16's canonical server-startup hook — see
   `node_modules/next/dist/docs/.../instrumentation.md`). It dynamically imports a **nodejs-runtime-
   only** ticker module that `setInterval(~5s)`s `applyDueTransitions()`. Singleton-guarded against
   double-registration; errors are logged, never thrown (must never crash the server or run at
   build time). **This is what makes "wait 2h with the tab closed and it still fires" literally
   true.** Record the honest scope note: the ticker runs inside the single Railway web service —
   genuinely autonomous for this one-instance demo, not a distributed scheduler.

**Verification steps**
- A drop with `opens_at` in the past and status `coming_soon` becomes `open` on the next read,
  with no admin call.
- A drop with `closes_at` in the past and status `open` becomes `closed` with a winner/losers on
  the next read, with no admin call.
- Server logs show the ticker firing on an interval; after a deadline passes, a plain
  `GET /api/drops` (no other action) reflects the drawn state.
- `pnpm typecheck` and `env -u DATABASE_URL pnpm build` both pass (the ticker is nodejs-guarded so
  it never runs at build).

**Acceptance Test** — the **no-intervention gate** (`scripts/m11-acceptance.ts`, self-cleaning on
throwaway drops so seeded demo state survives): create a drop with `closes_at = now + ~20s` and no
seed, insert ≥2 real entries (the production web funnel + an agent entry via the live MCP), then
**sleep past the deadline performing no further action**, and assert: the drop is `closed`, exactly
`total_slots` winners + the rest losers, and a winner purchase settles a **real on-chain USDC tx on
chain 4801** (verified by receipt). Separately, a `coming_soon` drop with `opens_at` in the past
auto-opens with zero admin calls.

**Exit Criteria**
- [ ] `coming_soon → open` fires automatically at `opens_at` (lazy + ticker).
- [ ] `open → closed` + real CSPRNG draw fires automatically at `closes_at`; no double-draw under
  concurrency.
- [ ] The no-intervention acceptance passes with a real settlement tx; build + typecheck green;
  deployed and the live ticker confirmed.

---

### M12 — Timer UI + SOLD OUT state + dedicated winner page
**Depends on:** M11.
**Goal:** The countdowns, the sold-out state, and a standalone winner page are visible and correct,
all driven by the real M11 state (never faked).

**Build steps**
1. `components/launch-timer.tsx` (client): a live countdown. Pre-launch shows "LAUNCHES IN 01:28"
   (and `Hh Mm` for the 2h drop); entry-open shows "ENTRIES CLOSE IN 00:42" beside the entry
   button. When it crosses a boundary (zero) it calls `router.refresh()` so the real, now-updated
   server state shows (open, or drawn → SOLD OUT / winner).
2. `components/item-panel.tsx`: render the launch timer when `coming_soon`, the entry timer when
   `open`, and a **bold disabled SOLD OUT block** (pop-brutalist, hard shadow) when `closed`/
   `settled`/drawn. If *this browser's* entry won, surface a "YOU WON → view" link to
   `/win/[entryId]`. Thread `opens_at`/`closes_at`/`drawn_at` through `drop-deck.tsx`; show small
   "next drop" timing in `hero-panel.tsx`.
3. `app/win/[entryId]/page.tsx` (server component) — the screenshottable winner page. States:
   `won` (YOU WON ✦ + product + finish + "PURCHASE — pay USDC" CTA), `purchased` (PURCHASED ✓ +
   amount + explorer tx link + hash), `lost`/`expired`/`pending` (honest state + link back),
   not-found → 404. Reuses `POST /api/drops/:id/purchase`, which resolves the winner's wallet
   server-side from `entry.wallet_address` (human demo wallet for web entries, the agent's wallet
   for agent entries) — so it works for **whoever wins**. A small client child handles the purchase
   click and polls `entry-status`. **Real USDC, real tx.** The inline win state in
   `world-id-entry.tsx` links to `/win/[entryId]` so both surfaces converge on one page.
4. Capture a screenshot of `/win/[entryId]` in a `won` state → `docs/screenshots/m12-winner.png`.
   **Screenshots use nix-provided Chromium** (replacing the M9 apt-`.deb` + `LD_LIBRARY_PATH`
   hack): `nix build nixpkgs#chromium` yields a fully-linked browser (verified resolvable as
   `/nix/store/…-chromium-…`); the screenshot script points playwright-core at
   `${chromium}/bin/chromium` via `executablePath` (resolve with `nix eval --raw
   nixpkgs#chromium.outPath` or `nix build --print-out-paths`; honor a `CHROMIUM_BIN` override).

**Verification steps**
- A forced-short-timer drop visibly progresses launch-timer → entry-timer → SOLD OUT in the UI.
- The winner page renders each state correctly; a `won` entry completes a real purchase from it.
- The screenshot is captured via nix Chromium (no manual lib extraction).

**Acceptance Test**
- The `/win/[entryId]` winner page, in a `won` state, completes a **real USDC purchase on chain
  4801** (tx hash recorded) and then shows `purchased` with an explorer link; a short-timer drop is
  shown going launch → entry → SOLD OUT driven purely by the M11 engine; the winner-page screenshot
  (`docs/screenshots/m12-winner.png`, taken with nix Chromium) is committed.

**Exit Criteria**
- [ ] Launch + entry countdowns shown on the panels/hero, driven by real `opens_at`/`closes_at`.
- [ ] SOLD OUT state shown once a drop is drawn/closed.
- [ ] `/win/[entryId]` page works for a human OR agent winner and completes a real purchase.
- [ ] Winner-page screenshot captured via nix Chromium and committed.

---

### M13 — Live demo tooling + runbook (concise judge run)
**Depends on:** M12.
**Goal:** One command sets the real 1:30 / 2h timers; an optional harness lets a presenter rehearse
the agent side alone; the runbook centers on the **real live flow** (the presenter's phone + real
agents), not an automated stand-in.

**Build steps**
1. `scripts/launch-demo.ts` — sets timestamps **only** (the clock does the rest; nothing is opened
   or drawn by the script):
   - Mac Mini: `status = open`, `opens_at = now`, `closes_at = now + 90s`, **no seed** (truly
     random).
   - GeForce RTX 5090: `status = coming_soon`, `opens_at = now + 2h`, `closes_at = now + 2h +
     <entry window, default 5m>` — at +2h it really opens, then really draws after its window.
   - Prints the exact wall-clock open/close times + live URLs. Configurable via
     `MAC_MINI_SECONDS`, `RTX_HOURS`, `RTX_ENTRY_SECONDS` (rehearse short, run the real thing at
     1:30 / 2h). Optional **off-by-default** `--seed-human` flag to stage the human web entry as
     the winner (the M9/M10 seeded-winner mechanism) for a run where the presenter wants a
     guaranteed win; default honors "truly random."
2. `scripts/practice-agents.ts` — an **optional solo-rehearsal harness, explicitly NOT used in the
   live demo** (where the presenter asks the real agents by hand). It has agent1 + agent2 call the
   **live MCP** `enter_draw(Mac Mini)` with real AgentKit signatures (the `m10-acceptance.ts`
   pattern), waits for the real `closes_at`, then `check_status` → prints genuine WON/LOST plus the
   settlement tx/link. Clearly labeled "practice only."
3. `DEMO_RUNBOOK.md` — rewrite around the real live arc: (Act 1) run `launch-demo.ts` → timers set,
   Mac Mini open ~90s; (Act 2) **presenter pulls out their phone, scans World ID in World App,
   enters live**; (Act 3) **presenter asks their real agents** (Claude/ChatGPT with the MCP
   connector) to enter — show the agent calling `enter_draw` and getting confirmation; (Act 4)
   everyone watches the **real countdown** hit zero → the server draws itself → winner page /
   SOLD OUT appear on their own; (Act 5) the winner purchases (presenter in-browser on
   `/win/[id]`, or the agent via the MCP `purchase` tool) → real USDC tx + explorer link. Include
   the 2h NVIDIA raffle as the "leave it running, it'll really fire" proof, the practice harness
   for solo rehearsal, the existing `reset-demo` choreography, and the Track-A qualification
   mapping.

**Verification steps**
- `launch-demo.ts` sets the timers and a subsequent no-touch wait resolves the drop on its own
  (reuses the M11 no-intervention behavior).
- `practice-agents.ts` runs green against the live MCP (agents enter, the draw fires on the clock,
  status confirmed).
- The runbook's live arc is documented end-to-end and is cold-runnable.

**Acceptance Test**
- After `scripts/launch-demo.ts`, leaving the system untouched, the Mac Mini drop opens (if
  staged from `coming_soon`) and auto-draws at its real `closes_at` with a real settlement
  available — no admin/script action between set-up and resolution. `DEMO_RUNBOOK.md` documents the
  full live flow (phone scan + real agents) and the practice harness runs green.

**Exit Criteria**
- [ ] `launch-demo.ts` sets real 1:30 (Mac Mini) / 2h (RTX 5090) timers and opens/draws nothing
  itself.
- [ ] `practice-agents.ts` exists, is labeled practice-only, and runs green against the live MCP.
- [ ] `DEMO_RUNBOOK.md` centers on the real live flow; the no-touch resolution is demonstrated.

---

## 4. Qualification-requirement traceability (keep this satisfied throughout)

| Requirement (Track A) | Where it's satisfied | Proof in demo |
|---|---|---|
| Uses AgentKit meaningfully (not a wrapper) | M7 (auth), M8 (settlement) — AgentKit is the auth + fairness + payment gate | Act 3/4: unsigned agent call rejected; signed call resolves to one human |
| Trial/initial-usage mechanic gated by verified humans | M4 (web), M7 (agent) — the **raffle slot** is the gated limited grant | Act 2/3: one slot per verified human; double-entry blocked |
| Build a product Human-Backed Agents operate (not just register) | M7–M10 — full storefront an agent transacts inside | Act 3–5: agent lists/asks/enters/wins/buys, real USDC |

> **Pitch framing (do not lose this):** call the raffle slot a *"limited initial-usage grant gated by a verified human,"* mirroring the sponsor's "free trials for agents / free access to initial usage" language.

---

## 5. Definition of done (whole project)
- [ ] **M0–M13** acceptance tests all pass, recorded in `PROGRESS.md`.
- [ ] Live Railway URL runs the full demo and resets cleanly.
- [ ] At least two real World Chain Sepolia USDC settlement txs captured (one web, one agent).
- [ ] One-slot-per-human enforced and *demonstrably* blocks duplicates on both surfaces.
- [ ] `DEMO_RUNBOOK.md` lets a human re-run the demo from cold in <5 min.
- [ ] No provisioned cloud resource was ever deleted.
- [ ] **Timers are genuinely time-driven (M11):** a drop set to launch/close at a future time
  opens and draws on the server's own clock with **no intervention** (proven by the M11
  no-intervention acceptance — set a deadline, wait, observe the autonomous draw + real on-chain tx).
- [ ] **Launch + entry countdowns, a SOLD OUT state, and a `/win/[entryId]` winner page (M12)** are
  live, with the winner page completing a real purchase (human OR agent winner); winner-page
  screenshot committed.
- [ ] **Live demo tooling (M13):** `scripts/launch-demo.ts` sets the real 1:30 (Mac Mini) / 2h
  (RTX 5090) timers and opens/draws nothing itself; `DEMO_RUNBOOK.md` centers on the real live flow
  (presenter's phone scan + real agents); the optional agent practice harness runs green.

> **Original M0–M10 scope is complete and accepted** (see `PROGRESS.md`). The checklist above is
> the *full* Definition of Done including the M11–M13 extension — the project is not "done" for the
> loop's purposes until M11–M13 are ACCEPTED too. Do **not** emit `RALPH-PROJECT-COMPLETE` until
> every box here is checked.
