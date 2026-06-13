# RALPH_GUIDE.md — Operating manual for the build loop

> Read this **at the start of every run**, before touching code. Then read `PROGRESS.md` to find where the last run stopped. Then continue the next unfinished milestone in `PRD.md`. Build order is strict: never skip ahead.

---

## 1. What you're building (10-second version)

A bot-proof scarce-goods drop platform for ETH Global NYC 2026, World Track A (AgentKit). **1 verified human = 1 raffle slot per drop**, enforced by World ID v4 nullifiers. Two surfaces (Next.js web app + remote MCP server) → one backend. Winner pays real USDC on World Chain Sepolia. Full context: `RESEARCH_REPORT.md`. What/when to build: `PRD.md`.

---

## 2. The loop's run protocol (every iteration)

You are run by `ralph.sh`, which spawns a **fresh** `claude` session each iteration (no resume). `ralph.sh` is dumb — it does **not** read the PRD or decide milestones. **You** do, using `PROGRESS.md` as your only cross-iteration memory. Do as much as you can each iteration; a new one starts only because your context ran out or you finished cleanly.

1. **Read** `RALPH_GUIDE.md` (this file) → `PROGRESS.md` → `PRD.md`.
2. **Resume, don't restart.** The current milestone is the first one whose Acceptance Test is **not** recorded as `ACCEPTED`/`PASSED` in `PROGRESS.md`. **Never re-run or re-verify a milestone already marked accepted** — trust the ledger and move on. If mid-milestone, continue from the noted step.
3. **Do as much as possible** toward the current Acceptance Test — keep going across sub-steps; don't stop at the first small unit.
4. **Run the milestone's Verification steps** as you go.
5. **Gate on the Acceptance Test.** Only when it objectively passes do you mark the milestone `ACCEPTED` in `PROGRESS.md`.
6. **Commit after each milestone or sub-milestone** to a feature branch `build/m<N>-<slug>` (never straight to `main`). Each meaningful unit = its own commit, clear message. Deploy to Railway when the milestone requires it.
7. **Append to `PROGRESS.md` before you finish** (see §12 for the exact format): the milestone id stamp, what you did, literal acceptance-test output / tx hashes / commands, deviations + why, and **NOTES FOR THE NEXT ITERATION**. Be generous — it's the next loop's only memory.
8. **Stop signals** — emit the exact token as the **last line** of your output when (and only when) it applies. See §13.

---

## 3. Hard constraints

**You have broad freedom** (the user explicitly authorized it): clear/reset the database, drop & recreate tables, wipe rows, deploy to Railway, and spend the testnet USDC/ETH in the demo wallets. Do whatever the build needs. The constraints below are the few real guardrails.

- **Don't destroy the *provisioning* itself.** The DB *data and tables* are fair game (clear them freely), but **do not delete the cloud resource instances**: the Railway project/service, the Railway Postgres *database service*, or the World app/RP. Those are slow to recreate and may require human re-auth. Deleting rows/tables = fine; deleting the Postgres service or the Railway app service = not fine. If you truly think the instance itself must be recreated, write it to `## BLOCKED` and ask.
- **Deploying to Railway is ALLOWED and expected.** Reuse the existing project/service if one exists; otherwise create one. Don't delete a pre-existing one.
- **Secrets never enter git.** `secret_keys`, `demo_wallets.md`, `.env`, `.env.*`, `*.key` are gitignored. Keep them that way. Never paste a private key or DB password into a committed file, a commit message, or `PROGRESS.md`. Reference them by name, not value.
- **Testnet only.** Spend the testnet tokens freely, but never send **mainnet** funds to the demo wallets. Chain is World Chain **Sepolia (4801)**, never mainnet (480).
- **No straight-to-`main` commits.** Branch per milestone.
- **Target World ID v4**, not v3. The provisioned app is a registered v4 cloud RP (see §5). Do not write `verifyCloudProof` v3 code.
- **No AgentKit "delegated bearer token."** It doesn't exist. Use AgentKit's native per-request signature + AgentBook resolution (PRD M7, Option A). A server-minted session token is allowed only as a cache that maps 1:1 to a verified `humanId`.
- **Effect-ts is dropped.** Plain TypeScript service modules. (Rationale: §6.)

---

## 4. Resource files (yours to use freely)

The user has placed two gitignored resource files in the repo root. **You may read and use them whenever you need them.**

### `secret_keys` (env values)
Contains: `WORLD_APP_ID`, `WORLD_APP_RP_ID`, `WORLD_APP_SIGNER_KEY`, `WORLD_MCP_API_KEY`, `WORLD_CHAIN_SEPOLIA_RPC`, and the primary **Agent Wallet** private key + address. Load these into `.env` locally and into Railway variables. **`DATABASE_URL` is NOT here** — it comes from Railway Postgres (provisioned in M1/M2 via `railway add --database postgres`): Railway injects it as a service variable. Pull it with `railway variables` (use the public proxy URL `DATABASE_PUBLIC_URL` for local dev; reference the private `DATABASE_URL` on the app service).

### `demo_wallets.md` (the three demo wallets + chain facts)
Contains chain facts (chain id **4801**, RPC, explorer, **USDC `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88`**, 6 decimals, `$10 = 10000000`) and three funded-demo wallets: **Agent 1**, **Agent 2**, **Human** (each with address + private key), plus the faucet funding checklist and demo-staging notes. Use these wallets for the seeded draw and settlement demos.

> If a value you need isn't in either file, check the World Developer Portal MCP (§5) or write a `## BLOCKED` note requesting it. Don't invent keys.

---

## 5. Verified environment facts (ground truth — these override the research report)

| Thing | Value |
|---|---|
| World ID app | `app_1f62e669c5b6b7ec0b22ee9fcb295a0a` ("ETH GLOBAL 2026"), engine `cloud`, active |
| World ID version | **v4 managed RP** `rp_8a9bfc2fcfa0ada9`, status `registered`, signer `0x22F2Fb02D1f631C71e9Aca6939a0D74315442821` |
| Verify endpoint | `POST https://developer.world.org/api/v4/verify/rp_8a9bfc2fcfa0ada9` |
| Proof-context / status | `/api/v4/proof-context/rp_8a9bfc2fcfa0ada9`, `/api/v4/rp-status/rp_8a9bfc2fcfa0ada9` |
| v4 actions | none yet (`actions_v4: []`) — create one per drop |
| Chain | World Chain **Sepolia, chain id `4801`** (480 = mainnet, do not use) |
| RPC | `https://worldchain-sepolia.g.alchemy.com/public` |
| Explorer | `https://sepolia.worldscan.org` |
| USDC (testnet) | `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` — Bridged USDC.e, 6 decimals |
| Railway project | **`worldcoin_app`** — id `c3751ac9-2806-4e9e-83d7-30504b6a059f`, env `production` (`928cd32e-b60e-43b3-86f7-2c7bbcb9476d`), in workspace "Carson Weeks's Projects". **Already exists — LINK to it, never create a new project.** No services yet (M1 adds the app service, M2 adds Postgres). |
| DB | Railway Postgres (provisioned in the project above via `railway add --database postgres`); `DATABASE_URL` injected as a service variable, pulled with `railway variables` |
| Toolchain | Node v22.20, pnpm 10.18, npm 11.6, Docker 28.4. Railway CLI **installed (5.12.1) and authenticated** as `carson@taho.is`. **All** Railway ops go through the CLI via the `use-railway` skill |

### MCP servers available to the loop (configured in `.mcp.json`)
- **`world-developer-portal`** (HTTP, authed with the team API key) — use for app/RP config, and to **create World ID v4 actions** per drop (`create_world_id_action`), check registration status, etc. Call `get_app_config` with the app id to re-confirm endpoints if unsure.
- **`railway`** — requires an OAuth handshake (`authenticate` → user completes in browser → `complete_authentication`). If the loop hits this and can't complete the browser step, write the auth URL to `## BLOCKED`. **The Railway CLI (`railway login`/`railway up`/`railway add`/`railway variables`/`railway domain`/`railway status`, etc.) is the path for ALL Railway operations** — deploy, DB provisioning, variables, domains, status. Use `--json` for parsing and never report a deploy done before `railway deployment list --json` shows terminal `SUCCESS`. The MCP is only a convenience for OAuth-scoped reads.

---

## 6. Stack decisions (final — don't re-litigate)

- **Next.js (App Router) + TypeScript** — web app + API routes + (preferably) the MCP route handler. `output: 'standalone'` for Docker.
- **Drizzle ORM** + Railway Postgres (provisioned via the Railway CLI; `DATABASE_URL` from the service variable). Migrations via `drizzle-kit` (run locally against the public URL or `railway run pnpm db:migrate`).
- **viem** for chain reads + USDC ERC-20 transfers on chain 4801.
- **`@modelcontextprotocol/sdk`** for the remote MCP server (streamable-HTTP transport so Claude/ChatGPT can add it as a custom connector).
- **`@worldcoin/idkit`** (web widget) + the v4 verify HTTP endpoint (server-side).
- **AgentKit SDK** (`verifyAgentkitSignature`, `createAgentBookVerifier`) for human-backed-agent auth.
- **Tailwind CSS + shadcn/ui** for the frontend, restyled to the pop-brutalist look (§11).
- **Railway** (Dockerfile) for hosting. **For every Railway operation — login, deploy, provisioning Postgres, variables, domains, status — invoke the `use-railway` skill** rather than hand-rolling `railway` flags; it carries the correct commands, deploy-`SUCCESS` polling, and `DATABASE_URL` wiring. The CLI is installed and authenticated as `carson@taho.is` (workspace "Carson Weeks's Projects").
- **NOT using Effect-ts.** Reason: steep learning curve is the top schedule risk for a hackathon timeline, and the architecture is identical with plain async service modules. If a future maintainer wants Effect, that's a post-hackathon refactor.

Confirm exact package names/versions at install time — some World/AgentKit package names may have changed since the research date; if a package 404s, search the World GitHub org / docs and record the correct name in `PROGRESS.md`.

---

## 7. The data model & the one invariant that matters

Full schema in `RESEARCH_REPORT.md` §4 and `PRD.md` M2. The single most important thing:

> **`entries` has `UNIQUE (drop_id, human_key)`.** `human_key` is the World ID **nullifier** on the web path and the AgentBook **`humanId`** on the agent path. This constraint *is* the Sybil guarantee. Every entry path must funnel through it. Never bypass it with raw inserts that skip the conflict handling.

Store nullifiers as `NUMERIC(78,0)` (or text) — they exceed bigint. USDC amounts as `NUMERIC(20,6)`.

---

## 8. Demo & fairness conventions

- The draw is **seedable** (admin-set seed on the drop) so a specific winner can be staged for judges; without a seed, use a real CSPRNG.
- The **admin/reset plane** (PRD M3) is load-bearing — build it early; every later milestone is demoed and reset through it.
- "Reset" (the demo action) = truncate `entries` + `orders` for *that drop only*, re-open it, reset the countdown. (You're also free to wipe/recreate the whole DB during development — see §3 — but the *demo* reset is scoped to one drop's data so the seeded products survive.)
- Demo target is the **live Railway URL**, not localhost. M10 proves it runs and resets there twice back-to-back.

---

## 9. Where to write things

| File | Purpose | Committed? |
|---|---|---|
| `PRD.md` | Milestones, acceptance tests (the plan) | yes |
| `RALPH_GUIDE.md` | This operating manual | yes |
| `RESEARCH_REPORT.md` | Product thesis + verified research | yes |
| `PROGRESS.md` | Run-by-run ledger (loop's memory) — **create in M0** | yes |
| `DEMO_RUNBOOK.md` | The judge demo script + reset choreography — **create in M10** | yes |
| `secret_keys`, `demo_wallets.md`, `.env*` | Secrets & wallets | **NO — gitignored** |
| `webinspo/` | Design reference images (4 PNGs) for the pop-brutalist look | yes (reference, no secrets) |

---

## 10. When in doubt
- Reality (verified env, `get_app_config`, on-chain reads) beats the research report. The report predates provisioning.
- The PRD's Acceptance Tests are the definition of "done" — not vibes, not "it compiles." A milestone isn't done until its acceptance test objectively passes and is recorded in `PROGRESS.md`.
- Prefer a smaller, *proven* slice over a larger, *unverified* one. Long-running means incremental and always-green, not big-bang.

---

## 11. Design direction — pop-brutalist (study `webinspo/` before building UI)

This is a **small, curated drop showcase** — a handful of featured products at a time (one live Mac Mini drop + one coming-soon item for the demo). **Not** a full store: no search, no cart, no accounts, no catalog. Think SNKRS / a Balenciaga campaign page / a featured-drops landing — high impact, low surface area.

**Aesthetic = pop-brutalist.** Reference images in `webinspo/`:
- `image.png` (Sui Overflow) — cream canvas, blue grid background, chunky 3D blocks, bold black sans, primary-color pops, hard-edge button with arrow.
- `image2.png` (Seal) — high-contrast black canvas, huge bold uppercase white type, neon outlined sticker motifs.
- `image3.png` (Gumroad UI Kit) — playful sticker pills, clean blocky components.
- `image4.png` (Balenciaga) — editorial drop-campaign layout: oversized display heading, acid/lime accent, lots of whitespace, minimal product-card grid, "SHOP THE COLLECTION."

**Concrete rules for the build:**
- Bold **oversized display type**; uppercase for headings is on-brand.
- **Hard edges**, square corners, **thick (2px+) black borders**, blocky cards with **hard/offset shadows** (no soft blurry drop-shadows as decoration).
- Pick **one canvas** and commit: cream/off-white *or* black. A subtle grid background is on-brand.
- **One electric accent** — acid/lime green as the primary action/highlight; optionally one more primary pop (orange/purple/blue) used sparingly for variant chips/stickers.
- Editorial **campaign layout**: huge hero heading, generous whitespace, a small grid of featured product cards.
- Built on **shadcn/ui + Tailwind**, restyled to this look (define the theme tokens — font, accent, border width, shadow — globally so `/admin` matches too). Cohesive, not busy.
- Capture a screenshot of the finished landing page into `PROGRESS.md` at M9 as proof it matches the direction.

---

## 12. `PROGRESS.md` format (your memory — the loop reads this)

Create `PROGRESS.md` in M0. **Append** one entry per iteration (never rewrite history). The loop greps it to display the current milestone, so **stamp the milestone id** in each entry. Suggested entry shape:

```markdown
## <date-time> — iter notes — M<N> <short title>
**Status of M<N>:** in_progress | ACCEPTED
**Did:** <what you built/changed this iteration, files, commits (hashes)>
**Acceptance test:** <the literal command(s) run + their output, tx hashes, screenshots>
**Deviations:** <anything that differed from PRD.md and why>
**NOTES FOR NEXT ITERATION:** <exactly what to do next, half-finished work, gotchas,
  package names you confirmed, IDs you created (Railway service id, World action id), etc.>
```

Rules:
- When a milestone passes its Acceptance Test, write **`Status of M<N>: ACCEPTED`**. The next iteration must skip it without re-testing.
- Record IDs/values you discover (Railway project/service IDs, created World ID action names, the live Railway URL, confirmed package names) so the next loop doesn't rediscover them.
- Never put secrets (private keys, DB passwords) in `PROGRESS.md` — reference by file/name only.

---

## 13. Stop signals (how to hand control back)

`ralph.sh` watches your output for two sentinel tokens. Emit one **only** when it truly applies, as the **last line** of your response:

### `RALPH-NEEDS-HUMAN` — you're blocked on something only a human can do
Use when you genuinely cannot proceed without a person: a faucet is rate-limited and the wallets have no funds; an OAuth/browser login you can't complete (e.g. Railway auth, AgentBook registration needing World App); a credential that isn't in `secret_keys`/`demo_wallets.md`; or a destructive action you're unsure about. Before emitting it:
1. Write **`BLOCKED.md`** at the repo root: what you need, why, and the **exact step-by-step** for the human to unblock you (commands to run, links to click, values to provide).
2. Append the same under a `## BLOCKED` heading in `PROGRESS.md`.
3. Output `RALPH-NEEDS-HUMAN` as the final line.

The loop will then **stop and alert the human** (terminal banner + desktop notification). The human resolves it, deletes `BLOCKED.md`, and re-runs `./ralph.sh`. So: if `BLOCKED.md` exists, a human hasn't cleared it yet — don't recreate it silently; check whether the blocker is actually resolved.

### `RALPH-PROJECT-COMPLETE` — everything is done
Emit only when **every** milestone M0–M10 is `ACCEPTED` in `PROGRESS.md` and the PRD's "Definition of done" checklist is fully satisfied. The loop exits success.

### Neither applies
Just finish your iteration normally. The loop spawns a fresh one and you continue from `PROGRESS.md`. **Prefer this** — don't over-eagerly block. Only block on a true human-only dependency, and only complete when truly complete.
