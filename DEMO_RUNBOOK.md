# DEMO_RUNBOOK.md — Proof-of-Human Drops (live judge demo)

> The **real, live** demo. Timers are genuinely time-driven — you set them once and the server's
> own clock opens entries and runs the draw, with the browser closed and nothing nudging it. The
> **World ID scan is done on the presenter's phone**, and the **agents are the presenter's real
> agents** (Claude / ChatGPT with the MCP connector). Nothing here is faked.
>
> Everything is against the **live Railway URL** — not localhost.
> If you have 30 seconds before judges: run the **Pre-demo checklist**, see all-green, run
> **`scripts/launch-demo.ts`**, and start narrating Act 1.

---

## The one-paragraph pitch

**Proof-of-Human Drops** is a bot-proof scarce-goods drop platform. Scarce stock (a Mac Mini,
instant-sellout) is allocated **one raffle slot per verified human per drop** — a *limited
initial-usage grant gated by a verified human*. Two surfaces hit one backend: a **web app**
(humans verify with World ID v4) and a **remote MCP server** (a human's AI agent enters/buys on
their behalf, carrying **AgentKit** proof-of-human). Each drop runs on a **real countdown**: when
the clock hits zero the **server draws itself** — truly random (CSPRNG) over whoever actually
entered — and the winner settles a **real USDC transfer on World Chain Sepolia (chain 4801)**. An
admin/reset plane re-runs the whole thing live, on demand.

---

## Live coordinates (verified working)

| Thing | Value |
|---|---|
| **Live site** | https://worldcoinapp-production.up.railway.app |
| **Landing** | `/` — the drop showcase (hero + featured cards + fairness stats + live countdowns) |
| **Live drop** | `/drops/c27f512e-af27-4963-88d3-a54bdab108a6` — **Mac Mini**, $10 |
| **Headline raffle** | **GeForce RTX 5090**, $50, id `aafd0d75-d313-4aec-8b26-e558a6ffd9ba` (the 2h "leave-it-running" drop) |
| **Winner page** | `/win/[entryId]` — the screenshottable YOU WON / PURCHASED page (web **or** agent winner) |
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
- both demo drops exist (Mac Mini + GeForce RTX 5090) with a World ID v4 action,
- Mac Mini is a fresh slate (0 entries, seed cleared),
- the MCP endpoint advertises all 5 tools.

> Statuses are **not** asserted by the checklist — `scripts/launch-demo.ts` sets them at demo
> time. The checklist proves the system is *ready*; launch-demo arms the clock.

If a wallet is 🔴 on USDC, top up before the demo:
- USDC faucet → https://faucet.circle.com (select **Worldchain Sepolia**, ~20 USDC / 2h)
- gas faucet → https://www.alchemy.com/faucets/world-chain-sepolia

---

## Arm the timers (one command — the clock does the rest)

```bash
pnpm exec tsx scripts/launch-demo.ts
```

This writes the **real** timestamps and **opens/draws nothing itself** — the M11 lifecycle engine
running inside the live server honors them on its own clock:

- **Mac Mini** → `open` now, **closes in 90s**, **no seed** (truly random winner).
- **GeForce RTX 5090** → `coming_soon`, **opens in 2h**, closes 2h + 5m — at +2h it really opens,
  then really draws after its entry window.

It prints the exact wall-clock open/close times and the live URLs. Tunables (rehearse short, run
the real thing at 1:30 / 2h):

```bash
MAC_MINI_SECONDS=60 RTX_HOURS=2 RTX_ENTRY_SECONDS=300 pnpm exec tsx scripts/launch-demo.ts
# Optional: stage a guaranteed human win (default is truly random):
pnpm exec tsx scripts/launch-demo.ts --seed-human
```

> **Why this is real, not smoke and mirrors:** the script only sets `opens_at` / `closes_at`. The
> background ticker (`lib/lifecycle.ticker.ts`, started by `instrumentation.ts` inside the single
> Railway web service) checks the clock every ~5s and flips `coming_soon → open` and runs the draw
> at `closes_at` — with the tab closed and no admin call. Verified: set a 45s timer, walk away, and
> the drop is `closed` with a winner ~1s after the deadline, drawn by the server, not by anyone.

---

## The live arc (5 acts)

> Narration cue in **bold**; the action under it. The whole arc maps to the 3 Track-A qualification
> requirements (table at the bottom). The presenter does the human + agent parts **for real**.

### Act 1 — Arm the drop (real countdown starts)
**"This is a live drop. One slot per *verified human* — and the clock is real: when it hits zero,
the server draws itself."**

1. Run `scripts/launch-demo.ts` (above). Mac Mini is now **open** with a **~90s countdown**.
2. Open the landing page `/`. Point at the **live countdown** on the Mac Mini card ("ENTRIES CLOSE
   IN 01:2x") and the **fairness stat block** ("1 SLOT / HUMAN", "∞ DUPLICATES BLOCKED").
3. Mention the **GeForce RTX 5090** card showing **"LAUNCHES IN 1h 59m"** — the headline raffle
   that really fires in 2h (see "Leave it running" below).

### Act 2 — The presenter verifies with World ID, on their phone, live
**"I'm a real human. Watch me prove it."**

1. Click into the Mac Mini drop `/drops/c27f512e-…`. Pick a variant (Silver / Black — brutalist
   chips).
2. Click **VERIFY WITH WORLD ID** → **scan the QR with World App on your phone** (orb
   proof-of-human). On success the page flips to **ENTERED** and the unique-humans count ticks up.
3. **The Sybil block:** try to enter again with the same World ID → the UI shows **ALREADY
   ENTERED**. `UNIQUE(drop_id, human_key)` (`human_key` = the World ID **nullifier**) rejects the
   second entry — no second row, no second slot.

> No phone/orb in the room? Drive the same funnel from `/admin` (Mac Mini → **+ dummy** adds an
> entry; a repeat of the same key is blocked). The verify endpoint is real — a bogus proof to
> `/enter` returns **422** (M4).

### Act 3 — The presenter asks their *real* agents to enter (AgentKit)
**"Now I ask my own AI agents to shop for me — and each one has to prove it's backed by a real
human, per request."**

In **Claude / ChatGPT with the MCP connector added** (`…/api/mcp`), ask the agent to enter the Mac
Mini draw. Show it calling `enter_draw` and getting a confirmation. Talking points:
- Every privileged MCP call carries an **AgentKit per-request CAIP-122/SIWE signature** —
  `verifyAgentkitSignature()` recovers the wallet, then resolves it to an anonymous **humanId**.
- **Unsigned call → rejected** (402-style challenge); a tampered signature is rejected too (not
  just header-presence).
- The agent gets **one slot per human** as well — a second entry for the same human is blocked by
  the *same* `UNIQUE(drop_id, human_key)` rule (here `human_key` = the humanId).

> **Solo rehearsal (NOT the live demo):** if you're practicing alone with no second agent, use the
> harness — see "Practice the agent side alone" below. In the live demo you ask your real agents by
> hand; the harness is only so one presenter can rehearse the agent arc.
>
> Cross-surface honesty: World ID nullifiers (web) and AgentKit humanIds (agent) are different
> identity namespaces, so dedupe holds **within each surface**. Both surfaces appear side-by-side in
> the admin console's cross-surface entry view (`source = web | agent`).

### Act 4 — The countdown hits zero — the server draws itself
**"Nobody clicks 'draw'. The clock runs out and the server picks a winner, live."**

1. Everyone watches the Mac Mini countdown reach **00:00**. No admin action, no script.
2. Within ~5s the page flips on its own: the card shows **SOLD OUT**, and whoever's browser holds a
   **winning** entry sees a **YOU WON → view** link to `/win/[entryId]`.
3. The draw is **truly random** (CSPRNG over the real entrants) — unless you launched with
   `--seed-human` to stage a guaranteed win.

> This is the M11 engine: `open → closed` + the draw fire on `closes_at` from the background
> ticker, atomically guarded so it draws exactly once. Proven by the M11 no-intervention acceptance
> and re-proven each time you run `launch-demo.ts` and wait.

### Act 5 — The winner pays — real USDC on chain 4801
**"The winner pays for real — on-chain USDC, here's the explorer link."**

- **Web winner (the presenter):** open `/win/[entryId]` (or click **YOU WON → view**). It shows
  **YOU WON ✦ — PURCHASE**. Click it → `POST /api/drops/:id/purchase` settles **10 USDC** from the
  **human** wallet → the merchant, waits for the receipt, flips the page to **PURCHASED ✓**, and
  shows the **explorer link** + tx hash.
- **Agent winner:** ask the winning agent to call the `purchase` MCP tool → a real USDC transfer
  from **its own registered wallet**, returning the tx hash + explorer link. The winner page
  resolves the wallet server-side from the entry, so the same `/win/[id]` page works for **whoever
  wins** — human or agent.
- **Non-winners are blocked:** a `lost` entry attempting purchase → **403 "not a winner"** (rejected
  *before* any transfer — the loser is never charged).

Open the explorer link → `status: success`, an ERC-20 transfer on the USDC contract, chain 4801.

---

## Leave it running — the 2h NVIDIA raffle (the strongest proof)

The **GeForce RTX 5090** drop set by `launch-demo.ts` opens in **2 hours** and draws after its
entry window — entirely on the server's clock. You can literally **close the laptop and walk
around the venue**: when you come back, the RTX card has gone `coming_soon → open` and (after its
window) `→ SOLD OUT` with a real winner, with nobody touching anything. That's the whole "no smoke
and mirrors" claim, made concrete. (Rehearse it fast with `RTX_HOURS=0` / a small
`RTX_ENTRY_SECONDS` to watch the same arc in seconds.)

---

## Practice the agent side alone (rehearsal only — NOT used in the live demo)

If you're practicing solo (no second presenter, no phone), rehearse the **agent arc** end-to-end:

```bash
# 1) arm a SHORT Mac Mini window so you don't wait 90s while rehearsing
MAC_MINI_SECONDS=60 pnpm exec tsx scripts/launch-demo.ts
# 2) run the harness — two demo agents enter via the LIVE MCP, the server draws on the clock,
#    the winner settles real USDC
BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/practice-agents.ts
```

`practice-agents.ts` has **agent1 + agent2 call the live MCP** `enter_draw(Mac Mini)` with **real
AgentKit signatures**, waits for the real `closes_at` (the live ticker draws — the script never
calls the admin draw route), then `check_status` → prints genuine **WON / LOST**, and the winner
calls the `purchase` tool → a **real on-chain USDC tx**. It is explicitly a **rehearsal tool**: in
the live demo you ask your *real* agents (Claude / ChatGPT) to do exactly this by hand.

---

## Reset choreography (between runs — one button, no DB surgery)

**One click** returns the whole system to a clean slate:

- **Admin console:** click **⟳ RESET DEMO**.
- **Or HTTP:**
  ```bash
  curl -X POST "https://worldcoinapp-production.up.railway.app/api/admin/drops/c27f512e-af27-4963-88d3-a54bdab108a6/reset-demo" \
    -H "x-admin-secret: $ADMIN_SECRET"
  ```

`reset-demo` (scoped to the seeded demo drops — nothing else is touched) clears each drop's entries
+ orders, re-opens it, clears `drawn_at` **and the seed**. Then just re-run `launch-demo.ts` to arm
fresh timers and start again at Act 1. Resetting clears the `(drop_id, human_key)` rows, so the
**same** World ID can re-enter the re-opened drop — exactly what repeated demos need.

> **Full automated rehearsal of the seeded-draw demo** (the older M10 5-act gate, two clean runs
> back-to-back with a `reset-demo` between, real settlement each run):
> ```bash
> BASE_URL=https://worldcoinapp-production.up.railway.app pnpm exec tsx scripts/m10-acceptance.ts
> ```

---

## Qualification-requirement traceability (Track A — AgentKit)

| Requirement | Proven in | In the demo |
|---|---|---|
| **Uses AgentKit meaningfully** (not a wrapper) — it's the auth + fairness + payment gate | Act 3 (auth), Act 5 (agent settlement) | Unsigned agent call rejected; signed call resolves to one human; the agent settles from its own wallet |
| **Trial / initial-usage mechanic gated by verified humans** — the raffle slot is a *limited initial-usage grant* | Act 2 (web), Act 3 (agent) | One slot per verified human per drop; the duplicate is visibly blocked on both surfaces |
| **A product Human-Backed Agents *operate*** (not just register) | Acts 3→5 | The agent lists drops, asks about coming-soon, enters, (wins,) buys real USDC — inside a full storefront |

> Pitch framing to keep: the raffle slot is a **"limited initial-usage grant gated by a verified
> human"** — the sponsor's "free trials / initial usage for agents" language.

---

## If something goes sideways (live-demo first aid)

- **A wallet is out of USDC** → checklist shows it 🔴. Hit the faucets (links above) or stage the
  win to a wallet with headroom (human/agent1 have the most).
- **`/admin` says 401** → wrong/blank secret. The value is in `.env` (`ADMIN_SECRET`) and on the
  Railway app service.
- **A drop is stuck `closed`** (a prior run drew it) → click **⟳ RESET DEMO**, then re-run
  `launch-demo.ts`.
- **The countdown looks frozen** → it's a *display* countdown; the truth is the server clock. A
  page refresh re-reads the real state. The ticker fires within ~5s of the deadline regardless.
- **MCP client can't connect** → re-run the checklist's MCP line; confirm `…/api/mcp` lists 5
  tools. The transport is stateless streamable-HTTP — no session to expire.
- **Real World ID proof unavailable in the room** → narrate Act 2 from the admin console
  (`+ dummy` + repeat-key block) and note the live verify endpoint is real (bogus proof → 422).
- **No second presenter for the agent arc** → run `scripts/practice-agents.ts` (rehearsal) to show
  the agent side, or ask one real agent live and skip the second.
