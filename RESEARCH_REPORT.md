# Proof-of-Human Drops — Feasibility & Architecture Report
### ETH Global NYC 2026 · World Track A (AgentKit)

> A bot-proof scarce-goods shopping platform where AI agents carry a World ID proof-of-human, so verified humans (and the agents acting for them) get fair access to limited stock that bots would otherwise sweep. SNKRS / Adidas Confirmed, but for tech hardware — and without the bot war.

**Status of this report:** Built from a fan-out deep-research pass (105 agents, 23 sources, 113 extracted claims, 25 adversarially verified — **25/25 confirmed, 0 refuted**). Findings 1–10 are backed by primary World/ETHGlobal sources with unanimous 3-0 verification votes. MCP-SDK specifics and the Effect/Drizzle/Railway infra judgments are engineering recommendations to re-verify at build time (flagged inline). Two material architecture flags are called out in §7 and §8 — read those before the PRD is frozen.

---

## 1. Executive Summary & The Pitch

### The one-liner
**"Proof-of-human access control for scarce drops. One verified human = one slot — whether they shop on our website or send their AI agent to do it for them."**

### The problem (why judges care)
Limited-stock drops — sneakers, GPUs, consoles, Apple hardware — are dominated by bots. Scalpers run hundreds of automated checkout sessions, sweep the inventory in milliseconds, and resell at a markup. Every existing defense (CAPTCHA, rate limits, "one per account") is defeated by the same trick: spin up more identities. The arrival of *agentic commerce* (people telling Claude/ChatGPT "buy me a Mac Mini at 3pm") makes this strictly worse — now the bots look exactly like legitimate AI shopping assistants, and merchants can't tell them apart.

### The insight
World's **AgentKit** (launched 2026-03-17) lets a verified human **delegate their World ID to an AI agent**, producing a "human-backed agent" that carries a zero-knowledge proof that *one unique human* stands behind it — without revealing who. Critically, **a merchant can see that all of one person's agents trace back to the same anonymous human identity.** A scalper running 100 agents is still recognized as one person and gets one person's allowance. [world.org AgentKit announcement; verified 3-0]

That is exactly the missing primitive for fair drops. The scarcity isn't enforced per-account or per-wallet (both Sybil-able) — it's enforced **per unique human**.

### What we build
A drops platform with **two entry points to the same backend**:
1. **A web app** (Next.js) — a normal human verifies once with World ID, enters the draw, and if drawn, pays in USDC.
2. **An MCP server** — the human's *agent* (Claude Desktop / ChatGPT) enters the same draw on their behalf, carrying their delegated proof-of-human, settling the same way.

Both paths converge on one rule: **1 World ID = 1 raffle slot per drop, nullifier-enforced.** Settlement is **real USDC on World Chain Sepolia testnet**, executed by the agent's wallet.

### The selling point to the judges
The World Track A prize page hints — *verbatim* — that the sponsor especially wants *"products that unlock free trials for agents and free access to initial usage."* [ethglobal.com/.../world; verified 3-0]. **A guaranteed, fair raffle slot is precisely a "limited initial-usage grant gated by a verified human."** We should frame the raffle slot in exactly that language during the pitch — it maps the project one-to-one onto the qualification bar the judges wrote down. This is the single most important framing decision in the whole project.

### Why it's a winning hackathon entry
- It uses AgentKit for its **actual core purpose** (telling human-backed agents apart from bots), not as a wrapper.
- It's a *product*, not a registration demo — it does something a real merchant would pay for.
- The demo is visceral and legible in 3 minutes: a bot tries to sweep stock and fails; a verified human's agent wins fairly.
- Real on-chain USDC settlement on World Chain gives it teeth.

---

## 2. How The App Works (End-to-End)

### Two surfaces, one backend

```
                         ┌─────────────────────────────────────┐
   HUMAN ───web──────────▶                                     │
                         │   Next.js app (web UI + API routes) │
                         │   ┌───────────────────────────────┐ │
   AGENT ──MCP/HTTP──────▶   │  Shared core (Effect services)│ │
   (Claude/ChatGPT)      │   │  - World ID verify + dedupe   │ │
                         │   │  - Draw engine                │ │──▶ Postgres (DO)
                         │   │  - USDC settlement (viem)     │ │
                         │   │  - AgentKit human resolution  │ │
                         │   └───────────────────────────────┘ │
                         └─────────────────────────────────────┘
                                          │
                                          ▼
                            World Chain Sepolia (USDC transfer)
```

### The validated user flow

Your proposed flow was directionally right but contained one mechanism that **does not exist as you described it** (the "delegated Bearer token via AgentKit"). Here is the corrected flow. The correction is explained in detail in §3-A and §7.

**Web path (the human shops directly):**
1. Human lands on the site, sees the upcoming **Mac Mini** drop (variants: Silver / Black) with a countdown.
2. Human clicks "Enter Draw" → IDKit widget opens → they verify with World ID. The **action is scoped to this specific drop** (`action = drop_<id>`).
3. Backend calls `verifyCloudProof(proof, app_id, action, signal)` and then enforces a `UNIQUE(nullifier_hash, drop_id)` constraint in Postgres. Second entry by the same human for the same drop → rejected. [docs.world.org/world-id/idkit/integrate; verified 3-0]
4. At drop close, the **draw engine** picks winners uniformly at random from the unique entries.
5. Winner gets a purchase window. They pay **USDC on World Chain Sepolia**; on confirmation, the order is fulfilled.

**Agent path (the human's agent shops for them) — corrected:**
1. Human verifies once on our web app and **registers their agent's wallet in AgentBook** through AgentKit (this is the real "delegation" step — it's a wallet registration backed by a World ID proof, *not* a bearer token). [github.com/worldcoin/agentkit; verified 3-0]
2. Human adds our **remote MCP server** to Claude/ChatGPT.
3. They chat naturally: *"Enter me in the Mac Mini drop, Silver."*
4. The agent calls our MCP tool. **On each call, the agent presents a signed CAIP-122/SIWE message** (AgentKit's x402-style header in response to a 402 challenge). Our server verifies the signature and **resolves the registering human to an anonymous `humanId` via AgentBook on World Chain.** [docs.world.org/agents/agent-kit/integrate; verified 3-0]
5. We map that `humanId` to the same per-drop uniqueness check. **The agent gets exactly the slot its human would have gotten — no more.**
6. If drawn, the agent's wallet settles the USDC purchase autonomously.

> **The key correction to your written flow:** "Platform issues a delegated token via AgentKit / user adds our MCP server with that token / backend validates human-backed token on every call" describes a bearer-token model. **AgentKit has no delegated-bearer-token primitive.** Its native model is per-request signature verification + AgentBook resolution. You have two clean options (decide before PRD freeze):
> - **(A) Native AgentKit flow** — per-request CAIP-122 signature verification on every MCP tool call. Strongest "meaningful AgentKit use" story for judging. Slightly more plumbing.
> - **(B) Custom session token** — keep a Bearer token for MCP-client ergonomics, but **mint it server-side from a verified AgentKit signature** so it provably maps to a resolved `humanId`. Document it explicitly as a custom convenience layer on top of AgentKit, not as an AgentKit feature.
>
> Recommendation: **(A) for the headline demo path, with (B) as an optional ergonomic fallback.** Judges reward using the real primitive.

### The "coming soon" second item
The demo includes a second product (e.g. a "Studio Display" or "Mac Studio") in **`coming_soon`** state. The MCP server exposes an informational tool (`get_drop_info`) so a user can ask their agent *"when does the next thing drop and what variants does it have?"* and get a structured answer. This showcases the MCP surface doing more than transactions and proves the agent is a real shopping concierge.

---

## 3. Explicit Answers to the Three Qualification Requirements

These are the exact bars from the Track A prize page [ethglobal.com/events/newyork2026/prizes/world; verified 3-0]. Each is answered with concrete implementation detail.

### Requirement 1 — *"Uses AgentKit in a meaningful way (not just a wrapper)."*

**Answer:** AgentKit is the load-bearing primitive of the entire product, not a feature bolted on.

- The platform's core value proposition — *fair access to scarce stock* — is **only possible** because AgentKit lets us resolve any agent to a single anonymous human (`humanId`) and refuse to let one human take more than one slot. Remove AgentKit and the product collapses back into a Sybil-able "one per account" system that bots defeat.
- Concretely, **every MCP tool call runs through AgentKit's signature verification + AgentBook resolution** (`verifyAgentkitSignature()` → recover wallet → `createAgentBookVerifier()` → resolve wallet to anonymous `humanId` on World Chain `eip155:480`). The resolved `humanId` is the **slot-allocation key**. [github.com/worldcoin/agentkit; docs.world.org/agents/agent-kit/integrate; verified 3-0]
- We use AgentKit's documented **x402-extension model**: an agent hitting a tool gets a `402` challenge; it answers with the base64 `agentkit` header carrying its signed CAIP-122 message; we verify, resolve, and *then* apply the access policy (proof-of-human required; payment required for purchase). This is exactly the pattern AgentKit was designed for. [world.org AgentKit announcement; verified 3-0]
- USDC settlement also rides AgentKit's documented money/payment path on World Chain.

This is "meaningful use": AgentKit is wired into the auth layer, the fairness layer, and the payment layer.

### Requirement 2 — *"Implements a clear 'trial / initial usage' mechanic (limited actions, credits, or time-based access) gated by verifiable humans via World ID."*

**Answer:** The **raffle slot itself is the gated, limited initial-usage grant.**

- **The limited resource:** one purchase slot per drop. Stock is deliberately scarce (1 Mac Mini class item, instant-sellout framing). Access to it is the "initial usage" being unlocked.
- **The gate:** World ID. A human must hold a valid World ID proof (verified via `verifyCloudProof`, Orb or Device verification level) to receive a slot. No proof → no entry. [docs.world.org/world-id/idkit/integrate; verified 3-0]
- **The limit, enforced:** **1 verified human = 1 slot per drop**, via a `UNIQUE(nullifier_hash, drop_id)` constraint. The action is scoped per drop so the same human can participate across *different* drops but never get two slots in *one* drop. [verified 3-0]
- **Time-based access:** the draw is a timed window — entries open at drop time, close on a deadline, winners get a bounded purchase window. This satisfies the "time-based access" wording too.

We will **explicitly call this our "trial/initial-usage unlock for agents"** in the pitch, mirroring the sponsor's own hint about "free trials for agents and free access to initial usage." This maps the project word-for-word onto the requirement.

### Requirement 3 — *"Not only register an agent, but actually build a product that enables Human Backed Agents to operate."*

**Answer:** We ship a working two-sided product, not a registration script.

- It is a **functioning storefront** with real inventory, variants, a timed draw engine, winner selection, and **real USDC settlement on World Chain Sepolia**. A human-backed agent can discover a drop, ask about variants, enter the draw, check status, and complete a purchase — entirely through MCP, end to end.
- The agent doesn't just *exist*; it **operates**: it transacts on behalf of its human, autonomously, with its proof-of-human checked on every privileged action and its USDC wallet executing the payment.
- The product is **useful to a real merchant** — it solves the bot-sweep problem that costs real drops real money. That's the difference between "registered an agent" and "built a product agents operate inside of."

---

## 4. Architecture & Data Model

### Services (Effect-ts layer — see §7 for the Effect risk call)
- `WorldIdService` — wraps `verifyCloudProof`; returns `{ nullifier_hash, verification_level }`.
- `AgentKitService` — `verifyAgentkitSignature()` + `createAgentBookVerifier()` → `humanId`.
- `DrawService` — entry, dedupe, draw execution, winner selection.
- `SettlementService` — viem client; builds + sends the USDC ERC-20 transfer on `eip155:480` (Sepolia); waits for receipt.
- `AdminService` — drop lifecycle + reset (see §5).

### Data model (Postgres / Drizzle)

```
drops
  id              uuid pk
  name            text                 -- "Mac Mini"
  status          enum('coming_soon','open','closed','settled')
  opens_at        timestamptz
  closes_at       timestamptz
  total_slots     int                  -- e.g. 1 (instant sellout) or N
  price_usdc      numeric(20,6)        -- USDC has 6 decimals
  created_at      timestamptz

variants
  id              uuid pk
  drop_id         uuid fk -> drops
  name            text                 -- "Silver" / "Black"
  sku             text
  stock           int

entries                                -- ONE per human per drop
  id              uuid pk
  drop_id         uuid fk -> drops
  variant_id      uuid fk -> variants
  human_key       text                 -- nullifier_hash (web) OR humanId (agent)
  source          enum('web','agent')
  nullifier_hash  numeric(78,0)        -- World ID nullifier (web path)
  human_id        text                 -- AgentBook humanId (agent path)
  verification_lvl enum('orb','device')
  status          enum('pending','won','lost','purchased','expired')
  created_at      timestamptz
  UNIQUE (drop_id, human_key)          -- ★ THE SYBIL GUARANTEE

agents                                 -- registered human-backed agents
  id              uuid pk
  wallet_address  text                 -- registered in AgentBook
  human_id        text                 -- resolved anonymous humanId
  registered_at   timestamptz

sessions                               -- only if using custom Bearer (option B)
  token           text pk
  human_id        text
  agent_id        uuid fk -> agents
  expires_at      timestamptz

orders
  id              uuid pk
  entry_id        uuid fk -> entries
  variant_id      uuid fk -> variants
  amount_usdc     numeric(20,6)
  tx_hash         text                 -- World Chain Sepolia tx
  status          enum('awaiting_payment','confirmed','failed')
  created_at      timestamptz
```

**The one constraint that matters:** `UNIQUE (drop_id, human_key)`. `human_key` is the nullifier hash on the web path and the AgentBook `humanId` on the agent path — both resolve to "one unique human," so the same person can't double-enter regardless of which surface they use. Store nullifiers as `NUMERIC(78,0)` (they exceed bigint range). [verified 3-0]

---

## 5. The Fair-Draw Mechanic + Admin / Demo Control Plane

### Draw algorithm (hackathon-grade, with an upgrade path)
- **Chosen approach: server-side uniform random selection** over the set of unique entries at `closes_at`. Simple, fast, fully under our control for live demos. [engineering judgment — medium confidence]
- **Seedable for demos:** make the RNG seed an admin-settable field on the drop so judges can watch a *deterministic* win on command (e.g., "the verified human's agent wins") without it looking rigged in the code review.
- **Upgrade path (say this out loud as "future work," don't build it now):** commit-reveal (publish `hash(seed)` before close, reveal `seed` after) or on-chain VRF for provable fairness. This signals you know the trust model without spending hackathon hours on it. [speedrunethereum commit-reveal guide; betterchecked provably-fair 2026]

### Admin / reset control plane (critical for the judge demo)
You explicitly need to reset and re-run the demo live. Build a minimal **admin panel** (or even just authenticated API routes) that can:
- **Create / open / close / settle** a drop on demand.
- **Reset a drop**: truncate `entries` + `orders` for that `drop_id`, set status back to `open`, reset the countdown. One click → fresh drop. ⚠️ Resetting clears the `(drop_id, human_key)` uniqueness rows, so the same World ID can re-enter the re-opened drop — which is exactly what you want for repeated demos.
- **Force-advance the clock** / trigger the draw immediately (don't make judges wait for a real countdown).
- **Set the RNG seed** so you can stage a specific winner.
- **Flip the second item** between `coming_soon` and `open`.

Gate the admin panel behind a simple shared secret in env — it's a hackathon, but don't leave it open.

---

## 6. Resources Needed to Build This Autonomously

Everything a build agent (Ralph loop) needs, with live links. **Pre-fund wallets well before judging — faucets are rate-limited.**

### Accounts & registrations to create
| Resource | Where | Notes |
|---|---|---|
| World Developer Portal app | developer.world.org | Gives `app_id`; create an **action ID per drop** (`drop_<id>`) or use dynamic actions |
| AgentKit setup | docs.world.org/agents/agent-kit | Register agent wallet(s) in **AgentBook** via World ID proof |
| Railway account | railway.app | Deploy Next.js via Dockerfile |
| DigitalOcean account | digitalocean.com | Managed Postgres |
| Alchemy account | alchemy.com | For World Chain Sepolia RPC + faucet |
| Circle account (faucet) | faucet.circle.com | Testnet USDC |

### Keys, IDs & env vars
```bash
# World ID
WORLD_APP_ID=app_xxx                 # from Developer Portal
WORLD_ACTION_PREFIX=drop_            # per-drop action scoping
# (v3 cloud flow recommended for hackathon — see §8 version risk)

# AgentKit / World Chain
WORLD_CHAIN_ID=480                   # eip155:480
WORLD_CHAIN_SEPOLIA_RPC=https://worldchain-sepolia.g.alchemy.com/v2/<KEY>
AGENT_WALLET_PRIVATE_KEY=0x...       # the agent's funded testnet wallet
AGENTBOOK_...                        # per AgentKit docs at build time

# USDC (TESTNET)
USDC_SEPOLIA_ADDRESS=0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88   # 6 decimals, Circle
# USDC MAINNET (do NOT use for demo): 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1

# Infra
DATABASE_URL=postgres://...@<DO-host>:25060/db?sslmode=require   # DO requires SSL
ADMIN_SECRET=...                     # gates the reset/admin panel
MCP_SESSION_SECRET=...               # if using option-B custom bearer
```

### Funded testnet wallets (fund BOTH assets, ahead of time)
- **Testnet ETH (gas):** Alchemy World Chain Sepolia faucet → https://www.alchemy.com/faucets/world-chain-sepolia (~0.1 ETH/day per address). [verified 3-0]
- **Testnet USDC:** Circle faucet → https://faucet.circle.com (lists **"Worldchain Sepolia"**, ~20 USDC per 2h per address). [verified 3-0]
- You need a funded **agent wallet** (sends USDC + pays gas) and possibly a separate **merchant/receiver wallet**.

### Verified contract addresses & chain facts (re-confirm at build time)
- **World Chain ID:** `480` (`eip155:480`). [verified 3-0]
- **USDC Sepolia testnet:** `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88`, **6 decimals**, Circle-issued. [docs.world.org/world-chain/tokens/usdc; verified 3-0] ⚠️ Independent on-chain readback was blocked (explorer 403); testnet contracts can be redeployed — **re-confirm against live docs immediately before the demo.**
- **World ID v3 Router (testnet):** `0x57f928158C3EE7CDad1e4D8642503c4D0201f611` (only if you go on-chain). [verified 3-0]

### Libraries
- `next`, `typescript`, `effect`, `drizzle-orm`, `pg`/`postgres`
- `@worldcoin/idkit` (web widget) + `@worldcoin/idkit-core/backend` (`verifyCloudProof`)
- `@worldcoin/agentkit` (or current AgentKit SDK package — confirm name at build)
- `viem` (USDC ERC-20 transfer + signing on `eip155:480`)
- `@modelcontextprotocol/sdk` (MCP server) — **confirm current transport API; see §8**

---

## 7. Stack Validation, Flagged Inconsistencies & Recommendations

### ✅ Coherent and well-matched
- **Next.js + TypeScript + World ID/IDKit + AgentKit + World Chain + USDC + Postgres** — all primary-sourced and mutually consistent. viem is the natural fit for the USDC transfer on `eip155:480`. [verified, medium-high]
- **Railway Dockerfile + DigitalOcean Postgres** — works; Railway has a documented Next.js guide. Use Next's `standalone` output for a lean image. DO Postgres requires `sslmode=require` in `DATABASE_URL`. [docs.railway.com/guides/nextjs]

### ⚠️ FLAG #1 — The biggest one: "delegated Bearer token via AgentKit" is not a real primitive
Your written flow assumes AgentKit hands you a delegated bearer token you validate per call. **It doesn't.** AgentKit's native model is **per-request CAIP-122/SIWE signature + AgentBook resolution to an anonymous `humanId`** (x402-style). [github.com/worldcoin/agentkit; docs.world.org/agents/agent-kit/integrate; verified 3-0]

**Decision required before PRD freeze** (covered in §2):
- **(A)** Adopt the native signature/AgentBook flow as MCP auth — *recommended for judging.*
- **(B)** Mint a custom server-side session bearer from a verified AgentKit signature, mapped to `humanId` — document as a custom layer.

Do **not** let the PRD instruct the build agent to "get a delegated token from AgentKit" — that call doesn't exist and the loop will thrash.

### ⚠️ FLAG #2 — Effect-ts is the schedule risk, not a correctness risk
Effect is powerful but has a **steep learning curve under a 2-day deadline**, and **Effect + Drizzle integration adds friction** (though Drizzle does document an Effect adapter). [orm.drizzle.team/docs/connect-effect-postgres]

**Recommendation:** Keep Effect **only if at least one builder already knows it.** Otherwise, **drop Effect** and use plain async/TypeScript service modules — the architecture in §4 is identical without it, and you save hours you'll want for the AgentKit signature flow and the live-demo polish. This is the highest-leverage scope cut available.

### ⚠️ FLAG #3 — Pin your World ID version
World ID is **mid-migration to v4** (rp_id-scoped OPRF nullifiers, `/api/v4/verify/{rp_id}`, `WorldIDVerifier`). v4 is an explicit **Request-for-Comments / spec-in-development** ("interfaces may change before release"), and **there is NO listed v4 WorldIDVerifier deployment on World Chain Sepolia.** Proof shapes differ (`nullifier_hash` vs `nullifier`; 4 vs 5 proof elements). [verified 3-0]

**Recommendation:** Build on the **established 3.x cloud flow (`verifyCloudProof`) with DB dedupe.** Lower risk, fully documented, no testnet gap. Target one version explicitly in code — don't straddle.

### Recommended additions
- A tiny **admin panel** (§5) — not optional; the demo depends on it.
- **Next standalone output** for the Docker image.
- A **seedable draw** for deterministic demo wins.
- Decide MCP **transport** (streamable-HTTP for a remote server that Claude/ChatGPT add as a custom connector — confirm current API).

---

## 8. Risks, Unknowns & Open Questions

| # | Risk / unknown | Severity | Mitigation |
|---|---|---|---|
| 1 | **AgentKit auth ≠ bearer token** (Flag #1) | **High** | Decide option A vs B before PRD; spec the real signature flow (Use A) |
| 2 | **Effect learning curve** in 2 days | **High** | Drop Effect unless a builder knows it |
| 3 | **World ID v4 migration** state; no v4 verifier on Sepolia | Medium | Use 3.x cloud flow; pin version in code |
| 4 | **Testnet USDC address may change** (couldn't independently read back) | Medium | Re-confirm against live docs the morning of the demo |
| 5 | **Faucet rate limits** (0.1 ETH/day; 20 USDC/2h) | Medium | Pre-fund wallets a day ahead; keep a backup funded wallet |
| 6 | **Gas sponsorship unknown** — does World Chain subsidize gas for verified humans on testnet? Not confirmed | Low | Assume agent self-funds gas from faucet |
| 7 | **MCP SDK transport + Claude/ChatGPT remote-MCP registration steps** not in confirmed claims | Low | Verify against current `@modelcontextprotocol/sdk` + Claude custom-connector docs at build |
| 8 | **MCP-SDK specifics uncited** in verified set | Low | Engineering detail; standard path exists |

### Open questions for the team (answer before PRD)
1. **MCP auth contract:** native AgentKit signature (A) or custom session bearer minted from a verified signature (B)? *(Recommendation: A as primary.)*
2. **World ID version:** 3.x cloud flow (recommended) or commit to 4.0?
3. **Keep Effect?** *(Recommendation: only if a builder knows it.)*
4. **On-chain vs cloud World ID verification?** *(Recommendation: cloud + DB dedupe for the hackathon; mention on-chain as a stretch.)*

---

## 9. What To Present To The Judges (Demo Script + Reset Choreography)

### The 3-minute demo (the story sells itself)

**Setup (before judges arrive):** agent wallet pre-funded with testnet ETH + USDC. One drop ("Mac Mini," Silver/Black, 1 slot, `open`) and one `coming_soon` item staged. RNG seed set so the verified human wins.

**Act 1 — The problem (20s).** "Limited drops get swept by bots. Now that everyone shops through AI agents, merchants can't even tell a scalper bot from a legit shopping assistant. Watch."

**Act 2 — Web path, the human (40s).** Open the web app. Show the Mac Mini drop + countdown. Click "Enter Draw" → World ID verify → entered. Try to enter **again** → **rejected: "one slot per verified human."** *This is the money shot — show the Sybil guarantee failing a double-entry live.*

**Act 3 — Agent path, the headline (60s).** Switch to Claude/ChatGPT with our MCP server connected. Type: *"Enter me in the Mac Mini drop, Silver, and buy it if I win."* The agent calls our tools, **presents its proof-of-human (AgentKit signature → resolved to one human)**, and enters. Then ask the agent: *"When's the next drop and what variants?"* — it answers from the `coming_soon` tool. Proves the agent is a real concierge, not a one-trick call.

**Act 4 — The draw + real settlement (40s).** Admin → close drop → run draw. The verified human wins (seeded). The agent's wallet **sends real USDC on World Chain Sepolia** — show the tx hash / explorer link. "That's a real on-chain settlement on World Chain."

**Act 5 — The close (20s).** "One verified human, one slot — whether they shop on our site or send their agent. AgentKit lets us give *agents* fair, gated initial-usage access that bots can't sweep. That's the trial-access mechanic the track asked for, built on the proof-of-human primitive that makes it possible."

### Reset choreography (between judge groups)
1. Admin → **Reset drop** (truncates entries/orders, re-opens, resets countdown). ⚠️ This clears the uniqueness rows so your World ID can re-enter.
2. Re-confirm agent wallet still has USDC + gas (top up from faucet if low — do this *between* groups, not during a pitch).
3. Re-confirm the seed is set for the staged win.
4. Flip the second item back to `coming_soon` if you advanced it.

### What to emphasize verbally (maps to the 3 requirements)
- "AgentKit is our auth, fairness, **and** payment layer — not a wrapper." (Req 1)
- "The raffle slot **is** the gated initial-usage grant — exactly what the track asked for." (Req 2)
- "This is a working storefront human-backed agents transact inside of — real USDC, real fulfillment." (Req 3)

---

### Appendix — Verification provenance
Research pass: 105 agents · 23 sources (primary-weighted) · 113 claims extracted · 25 adversarially verified (3-vote, need 2/3 to refute) · **25 confirmed, 0 refuted.** Primary sources include `ethglobal.com/events/newyork2026/prizes/world`, `world.org/blog/announcements/now-available-agentkit-...`, `github.com/worldcoin/agentkit`, `docs.world.org/agents/agent-kit/integrate`, `docs.world.org/world-id/idkit/integrate`, `docs.world.org/world-chain/tokens/usdc`, `docs.world.org/world-id/reference/api`, `faucet.circle.com`, `alchemy.com/faucets/world-chain-sepolia`. Items marked "engineering judgment / medium confidence" (MCP-SDK transport, Effect/Drizzle/Railway infra, draw algorithm) are not in the verified-claims set and should be re-confirmed at build time.
