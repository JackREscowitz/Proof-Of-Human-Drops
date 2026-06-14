# DEMO_RUNBOOK.md — Proof-of-Human Drops (judge demo script)

> The 5-act live demo, the reset choreography between runs, and the pre-demo checklist.
> Everything here is against the **live Railway URL** — not localhost.
> Created in M10. If you have 30 seconds before judges: run the **Pre-demo checklist**, see
> all-green, and start at **Act 1**.

---

## The one-paragraph pitch

**Proof-of-Human Drops** is a bot-proof scarce-goods drop platform. Scarce stock (a Mac Mini,
instant-sellout) is allocated **one raffle slot per verified human per drop** — a *limited
initial-usage grant gated by a verified human*. Two surfaces hit one backend: a **web app**
(humans verify with World ID v4) and a **remote MCP server** (a human's AI agent enters/buys
on their behalf, carrying **AgentKit** proof-of-human). At drop close a **fair, seedable draw**
picks the winner, who settles a **real USDC transfer on World Chain Sepolia (chain 4801)**. An
admin/reset plane re-runs the whole thing live, on demand.

---

## Live coordinates (verified working)

| Thing | Value |
|---|---|
| **Live site** | https://worldcoinapp-production.up.railway.app |
| **Landing** | `/` — the drop showcase (hero + featured cards + fairness stats) |
| **Live drop** | `/drops/c27f512e-af27-4963-88d3-a54bdab108a6` — **Mac Mini**, $10, open |
| **Coming-soon** | **Mac Studio**, $20, `coming_soon` (id `aafd0d75-d313-4aec-8b26-e558a6ffd9ba`) |
| **Admin console** | `/admin` — enter `ADMIN_SECRET` (in `.env` / Railway), then drive everything |
| **MCP endpoint** | `…/api/mcp` — streamable-HTTP, 5 tools (`list_drops`, `get_drop_info`, `enter_draw`, `check_status`, `purchase`) |
| **Chain / USDC** | World Chain **Sepolia 4801** · USDC `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` (6 dec) |
| **Explorer** | https://sepolia.worldscan.org |

**Demo wallets** (in `demo_wallets.md` / `.env`; keys never leave the server):
- **Human** `0x14BAf4Ab5D7324bfdD9De78d5d7c0BF63F639781` — the web winner pays from here.
- **Agent 2** `0xE56F3bA6A66A51c0783069390278e14bdB5A1389` — a winning agent pays from here.
- **Agent 1** `0x8BAf91Af9682b5Cc0d69DBE7152f962558D754a7` — the default merchant/receiver.

---

## Pre-demo checklist (run this first — ~10s)

```bash
BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/predemo-check.ts
```

Prints a 🟢/🔴 board. **All-green means demo-ready.** It verifies:
- app + DB health,
- wallet USDC + ETH balances (human & agent2 each ≥ $10 USDC + gas),
- Mac Mini `open` + 0 entries (fresh) + seed cleared; Mac Studio `coming_soon`,
- both drops have a World ID v4 action,
- the MCP endpoint advertises all 5 tools.

If a wallet is 🔴 on USDC, top up before the demo:
- USDC faucet → https://faucet.circle.com (select **Worldchain Sepolia**, ~20 USDC / 2h)
- gas faucet → https://www.alchemy.com/faucets/world-chain-sepolia

---

## The 5 acts

> Narration cue in **bold**; the action under it. The whole arc maps to the 3 Track-A
> qualification requirements (table at the bottom).

### Act 1 — One human, one slot (the Sybil gate, web)
**"Scarce stock. One slot per *verified human* — and we prove bots can't farm it."**

1. Open the landing page `/`. Point at the **fairness stat block** ("1 SLOT / HUMAN", "∞
   DUPLICATES BLOCKED") and the **Mac Mini** card (live, $10).
2. Click into `/drops/c27f512e-…`. Pick a variant (Silver / Black — brutalist chips).
3. Click **VERIFY WITH WORLD ID** → scan with **World App** (orb proof-of-human). On success
   the page flips to **ENTERED** and the unique-humans count ticks up.
4. **The block:** try to enter again with the same World ID → the UI shows **ALREADY ENTERED**.
   The `UNIQUE(drop_id, human_key)` constraint (`human_key` = the World ID **nullifier**)
   rejects the second entry — no second row, no second slot.

> If you can't get a phone/orb proof in the room: drive the same funnel from the operator
> console (Admin → Mac Mini → **+ dummy** adds an entry; a repeat of the same key is blocked).
> The verify endpoint is real — a bogus proof to `/enter` returns **422** (`M4`).

### Act 2 — A human-backed *agent* enters via MCP (AgentKit)
**"Now the same store, but a human's AI agent shops inside it — and it has to prove it's
backed by a real human, per request."**

Run the scripted MCP client (or do it live in Claude/ChatGPT with the connector added):

```bash
BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/m8-acceptance.ts
```

Talking points while it runs:
- The agent calls `enter_draw` over the **remote MCP server**. Every privileged call carries an
  **AgentKit per-request CAIP-122/SIWE signature** — `verifyAgentkitSignature()` recovers the
  wallet, then resolves it to an anonymous **humanId**.
- **Unsigned call → rejected** (402-style challenge). Signature is genuinely enforced (a tampered
  sig is rejected, not just header-presence).
- The agent gets **one slot per human** too — a second entry for the same human is blocked by the
  *same* `UNIQUE(drop_id, human_key)` rule (here `human_key` = the humanId).

> Cross-surface honesty: World ID nullifiers (web) and AgentKit humanIds (agent) are different
> identity namespaces, so dedupe holds **within each surface**. Both surfaces appear side-by-side
> in the admin console's cross-surface entry view (`source = web | agent`).

### Act 3 — The fair, *seedable* draw
**"At close we draw a winner uniformly at random — and it's seedable, so I can show you a
specific human win, deterministically, without hiding anything in the code."**

In `/admin` (after entering the secret and **Load**):
1. (Optional) **set seed** on Mac Mini to stage who wins (the draw ranks entries by
   `SHA-256(seed : entryId)` ascending — same seed + same entries → same winner, every time).
2. Click **draw** on Mac Mini. The cross-surface entry list updates: the staged entry → **won**,
   the rest → **lost**. The drop flips to **closed**.

> No seed set ⇒ a real CSPRNG (`node:crypto`) picks the winner. The seed is for staging a
> *watchable* win, not for rigging — the algorithm is the same either way.

### Act 4 — Real USDC settlement on World Chain Sepolia
**"The winner pays for real — on-chain USDC, chain 4801, here's the explorer link."**

- **Web winner:** on the drop page the winner now sees **YOU WON ✦ — PURCHASE**. Click it →
  `POST /api/drops/:id/purchase` settles **10 USDC** from the **human** wallet → the merchant,
  waits for the receipt, flips the entry to **PURCHASED ✓**, and shows the **explorer link**.
- **Agent winner (if you staged the agent):** the agent calls the `purchase` MCP tool → a real
  USDC transfer from **its own registered wallet**, returning the tx hash + explorer link.
- **Non-winners are blocked:** a `lost` entry attempting purchase → **403 "not a winner"**
  (rejected *before* any transfer — the loser is never charged).

Open the explorer link → `status: success`, an ERC-20 transfer to the USDC contract.

### Act 5 — "When's the next drop?" (coming-soon via MCP)
**"And the agent can ask about what's next — the informational surface."**

In the MCP client (or Claude/ChatGPT): call `get_drop_info` for **Mac Studio** →
`status: coming_soon`, price $20, variants Silver/Black. This is the agent-facing "what drops
next, what variants" tool. (To reveal it live, Admin → Mac Studio → **flip** → it goes `open`.)

---

## Reset choreography (between runs — one button, no DB surgery)

**One click** returns the whole system to Act-1 state:

- **Admin console:** click **⟳ RESET DEMO**.
- **Or HTTP:**
  ```bash
  curl -X POST "https://worldcoinapp-production.up.railway.app/api/admin/drops/c27f512e-af27-4963-88d3-a54bdab108a6/reset-demo" \
    -H "x-admin-secret: $ADMIN_SECRET"
  ```

`reset-demo` (scoped to the seeded demo drops — nothing else is touched):
1. **Mac Mini** → clears its entries + orders, re-opens it, clears `drawn_at` **and the seed**
   (fresh slate the demo re-stages),
2. **Mac Studio** → back to `coming_soon` (in case Act 5 flipped it open).

Then re-run the checklist (it confirms 0 entries / open / coming_soon) and start again at Act 1.
Resetting clears the `(drop_id, human_key)` rows, so the **same** World ID can re-enter the
re-opened drop — exactly what repeated demos need.

> **Stage a specific winner across resets:** entry ids change each run, so the simplest reliable
> staging is to make the intended winner the **sole/first real entrant** of its surface, or
> brute-force a seed suffix after entries exist until the target sorts first (what
> `scripts/m10-acceptance.ts` does). For a clean judge demo, enter as the human first, then let
> the agent enter as the loser.

---

## Full automated rehearsal (proves it end-to-end, twice)

```bash
BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/m10-acceptance.ts
```

Runs all 5 acts **twice back-to-back** on the live URL with a `reset-demo` between, with **real**
on-chain settlement each run, and prints both explorer links. This is the M10 acceptance gate —
"no manual DB surgery between runs." (Last green run: see `PROGRESS.md` M10 entry for the two
tx hashes.)

---

## Qualification-requirement traceability (Track A — AgentKit)

| Requirement | Proven in | In the demo |
|---|---|---|
| **Uses AgentKit meaningfully** (not a wrapper) — it's the auth + fairness + payment gate | Act 2 (auth), Act 4 (agent settlement) | Unsigned agent call rejected; signed call resolves to one human; the agent settles from its own wallet |
| **Trial / initial-usage mechanic gated by verified humans** — the raffle slot is a *limited initial-usage grant* | Act 1 (web), Act 2 (agent) | One slot per verified human per drop; the duplicate is visibly blocked on both surfaces |
| **A product Human-Backed Agents *operate*** (not just register) | Acts 2→5 | The agent lists drops, asks about coming-soon, enters, (wins,) buys real USDC — inside a full storefront |

> Pitch framing to keep: the raffle slot is a **"limited initial-usage grant gated by a verified
> human"** — the sponsor's "free trials / initial usage for agents" language.

---

## If something goes sideways (live-demo first aid)

- **A wallet is out of USDC** → checklist shows it 🔴. Hit the faucets (links above) or stage the
  win to a wallet with headroom (human has the most).
- **`/admin` says 401** → wrong/blank secret. The value is in `.env` (`ADMIN_SECRET`) and on the
  Railway app service.
- **The drop is stuck `closed`** (you drew but didn't reset) → click **⟳ RESET DEMO**.
- **MCP client can't connect** → re-run the checklist's MCP line; confirm `…/api/mcp` lists 5
  tools. The transport is stateless streamable-HTTP — no session to expire.
- **Real World ID proof unavailable in the room** → narrate Act 1 from the admin console
  (`+ dummy` + repeat-key block) and note the live verify endpoint is real (bogus proof → 422).
