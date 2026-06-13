@AGENTS.md

# Project canon (read these first)

The build is driven by three repo docs — the Ralph loop reads them at the start of every
iteration, and so should you. They are NOT `@`-imported here (that would double-load them in
the loop); open them directly:

- `RALPH_GUIDE.md` — operating rules, verified env facts, stack decisions, hard constraints.
- `PRD.md` — the milestone plan (M0–M10): what to build, in what order, how to prove each.
- `PROGRESS.md` — cross-iteration ledger / the loop's only memory. **§0 of the PRD and the
  ground-truth tables override `RESEARCH_REPORT.md` wherever they disagree.**

`RESEARCH_REPORT.md` is the original thesis but is **superseded by ground-truth** — treat it
as background, not fact.

# Reference docs (fetch on demand)

Bare URLs are hints, not auto-loaded — `WebFetch` them when relevant.

## Stack
- Next.js (modified build — see `AGENTS.md`): **read `node_modules/next/dist/docs/index.md`
  and the bundled guides under `node_modules/next/dist/docs/`** — NOT the public Next site.
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- viem: https://viem.sh/docs/getting-started
- MCP (server SDK + transports): https://modelcontextprotocol.io/

## World ID / World Chain
- World docs (LLM index): https://docs.world.org/llms.txt
- World docs (human): https://docs.world.org/
- World ID IDKit (web widget): https://docs.world.org/world-id
- World Chain Sepolia explorer (chain 4801): https://sepolia.worldscan.org

## Infra
- Railway docs: https://docs.railway.com/
- Railway operations in this repo go through the **`use-railway` skill** (CLI installed &
  authenticated) — invoke it for deploy, Postgres provisioning, variables, domains, status.
