#!/usr/bin/env bash
#
# ralph.sh — long-running Ralph loop for the Proof-of-Human Drops build.
#
# Each iteration spawns a FRESH `claude` headless session (no --resume), pointed at
# the project docs. The agent's cross-iteration memory lives in PROGRESS.md (which it
# reads at the start and appends to at the end). The loop just keeps re-spawning until
# the project is DONE or the agent signals it's BLOCKED on human input.
#
# Design decisions (per the build owner):
#   - Harness: `claude --dangerously-skip-permissions` (running in a throwaway VM — no
#     security concern with bypassing permissions).
#   - Terminal shows ONLY Claude's natural-language text as it streams (tool calls are
#     suppressed). Full structured logs (incl. tool activity) go to per-iteration files.
#   - A milestone, once ACCEPTED, is never re-tested — the agent reads PROGRESS.md and
#     skips completed milestones. The loop does not re-run acceptance criteria itself.
#   - Each milestone / sub-milestone commits (the agent does this; the loop verifies a
#     commit appeared and warns if not).
#   - The agent does as much as possible per iteration; a new iteration only starts
#     because the previous session ended (context full / turn complete).
#   - If the agent needs human input, it writes a BLOCKED sentinel and the loop STOPS
#     and alerts the human (terminal banner + desktop notification if available).
#
# Usage:
#   ./ralph.sh                 # run until DONE or BLOCKED or max iterations
#   MAX_ITERS=50 ./ralph.sh    # override iteration cap
#   ./ralph.sh --once          # single iteration (debugging)
#
set -uo pipefail

# ------------------------------------------------------------------ config ---
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

MODEL="${MODEL:-opus}"
EFFORT="${EFFORT:-high}"
MAX_ITERS="${MAX_ITERS:-100}"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/.ralph}"
STATE_LOG="$LOG_DIR/ralph.log"          # high-level loop ledger (milestone tap-in)
CURRENT_LINK="$LOG_DIR/current.log"     # symlink to the live iteration's raw stream
PROGRESS_FILE="$PROJECT_DIR/PROGRESS.md"
BLOCKED_FILE="$PROJECT_DIR/BLOCKED.md"  # agent writes here when it needs a human

mkdir -p "$LOG_DIR"

# Stop signals the agent can emit (it's told about these in the prompt + RALPH_GUIDE).
#   PROJECT-COMPLETE  -> all milestones done; loop exits success.
#   NEEDS-HUMAN       -> blocked on human input; loop stops and alerts.
DONE_SENTINEL="RALPH-PROJECT-COMPLETE"
BLOCK_SENTINEL="RALPH-NEEDS-HUMAN"

# --------------------------------------------------------------- utilities ---
ts()        { date +"%Y-%m-%dT%H:%M:%S%z"; }
loop_log()  { printf '%s | %s\n' "$(ts)" "$*" | tee -a "$STATE_LOG" >&2; }

have() { command -v "$1" >/dev/null 2>&1; }

notify_human() {
  # message in $1. Best-effort desktop notification; always prints a loud banner.
  local msg="$1"
  printf '\n'
  printf '\033[1;41m  ████████████████████████████████████████████████████  \033[0m\n'
  printf '\033[1;41m  ██  RALPH NEEDS YOU                                ██  \033[0m\n'
  printf '\033[1;41m  ████████████████████████████████████████████████████  \033[0m\n'
  printf '\033[1;33m  %s\033[0m\n\n' "$msg"
  if have notify-send; then notify-send -u critical "Ralph needs human input" "$msg" || true; fi
  if have tput;        then tput bel 2>/dev/null || true; fi   # terminal bell
  printf '\a'                                                   # bell fallback
}

# Extract the latest milestone marker the agent has recorded, for the tap-in log.
current_milestone() {
  [ -f "$PROGRESS_FILE" ] || { echo "M0 (not started)"; return; }
  # Last line in PROGRESS.md that looks like "M<n>" — agent is asked to stamp these.
  grep -oE 'M[0-9]+[^|]*' "$PROGRESS_FILE" 2>/dev/null | tail -1 | sed 's/[[:space:]]*$//' \
    || echo "unknown"
}

# --------------------------------------------------------------- the prompt ---
# Kept terse: the durable instructions live in the repo docs. The agent reads them.
read -r -d '' RALPH_PROMPT <<'PROMPT'
You are one iteration of a long-running autonomous build loop ("Ralph"). You run in a
fresh context each time; your memory across iterations is the repo's PROGRESS.md.

DO THIS, IN ORDER:
1. Read RALPH_GUIDE.md (operating rules), then PROGRESS.md (what past iterations did),
   then PRD.md (the milestone plan). Reality/verified-env facts override the research report.
2. Determine the current milestone: the first one whose Acceptance Test is NOT already
   recorded as PASSED in PROGRESS.md. DO NOT re-run or re-verify milestones already marked
   accepted — trust PROGRESS.md and move on. Start from where the last iteration stopped.
3. Make progress toward that milestone's Acceptance Test. Do as MUCH as you can this
   iteration — keep going across sub-steps; only stop when the work is genuinely done for
   now or you're out of room. You are in a VM with --dangerously-skip-permissions: you may
   freely clear the DB, deploy to Railway, spend testnet tokens, run any command.
   For ANY Railway operation (login, deploy, provisioning Postgres, variables, domains,
   status), invoke the `use-railway` skill instead of guessing CLI flags — it carries the
   correct commands, deploy-success polling, and DATABASE_URL wiring. The CLI is already
   installed and authenticated.
4. COMMIT after each milestone or sub-milestone (feature branch build/m<N>-<slug>, never
   straight to main). Use clear messages. Each meaningful unit of work = its own commit.
5. Append to PROGRESS.md before you finish: a dated entry stamping the milestone id (e.g.
   "M3 ..."), what you did, the literal acceptance-test output / tx hashes / commands you
   ran, deviations + why, and NOTES FOR THE NEXT ITERATION (what to do next, gotchas,
   anything half-finished). This is the only memory the next loop has — be generous.

STOP SIGNALS — print the EXACT token on its own line as the LAST thing you output:
- If you need a human (faucet rate-limited and no funds, an OAuth/browser login you can't
  complete, a credential not in secret_keys/demo_wallets.md, a destructive action you're
  unsure about): write BLOCKED.md explaining precisely what you need and the exact steps
  for the human, append the same to PROGRESS.md under "## BLOCKED", then output the token:
  RALPH-NEEDS-HUMAN
- If EVERY milestone M0–M10 is accepted and the whole project's Definition of Done is met:
  output the token:
  RALPH-PROJECT-COMPLETE
- Otherwise, just finish your iteration normally (the loop will start a fresh one).

Do not output a stop token unless it truly applies. Begin now.
PROMPT

# ------------------------------------------------------------------- run one ---
run_iteration() {
  local n="$1"
  local raw="$LOG_DIR/iter-$(printf '%03d' "$n").jsonl"
  local txt="$LOG_DIR/iter-$(printf '%03d' "$n").txt"
  ln -sfn "$raw" "$CURRENT_LINK"

  loop_log "iter $n START — milestone: $(current_milestone)"
  printf '\033[1;36m\n┌─ Ralph iteration %d  (milestone: %s)\n└─ raw log: %s\033[0m\n\n' \
    "$n" "$(current_milestone)" "$raw"

  # Stream as newline-delimited JSON so we can both:
  #   (a) show a LIVE, readable feed in the terminal — assistant text PLUS one-line
  #       markers for every tool call/result/task so you can see it's working even
  #       during long tool-heavy stretches (no more minutes of dead silence), and
  #   (b) keep the full event stream on disk for debugging / the next human.
  # ANSI: dim grey for tool activity, cyan for task markers, default for assistant text.
  claude -p "$RALPH_PROMPT" \
      --model "$MODEL" \
      --dangerously-skip-permissions \
      --output-format stream-json \
      --include-partial-messages \
      --verbose \
    2>>"$LOG_DIR/iter-$(printf '%03d' "$n").stderr" \
    | tee "$raw" \
    | stdbuf -oL jq -j --unbuffered '
        # ---- token-by-token assistant text deltas (the natural-language stream) ----
        if .type=="stream_event" and .event.type=="content_block_delta"
           and (.event.delta.type=="text_delta")
        then .event.delta.text

        # ---- tool calls: print a dim one-line marker so the terminal shows life ----
        elif .type=="assistant" and (.message.content|type=="array")
        then ( [ .message.content[]
                 | select(.type=="tool_use")
                 | "\n[2m  → " + .name
                   + ( .input
                       | if .command   then ": " + (.command|tostring)
                         elif .file_path then " " + (.file_path|tostring)
                         elif .path      then " " + (.path|tostring)
                         elif .pattern   then " /" + (.pattern|tostring) + "/"
                         elif .description then ": " + (.description|tostring)
                         else "" end )
                   | .[0:160]
                 + "[0m" ] | join("") )

        # ---- background task lifecycle (e.g. long bash like create-next-app) ----
        elif .type=="system" and .subtype=="task_started"
        then "\n[36m  ⟳ task: " + (.description // .task_type // "running") + "[0m"
        elif .type=="system" and .subtype=="task_completed"
        then "[36m ✓[0m"

        # ---- init banner: confirms the session actually started ----
        elif .type=="system" and .subtype=="init"
        then "[2m  [session " + ((.session_id // "?")[0:8]) + " started, model " + (.model // "?") + "][0m\n"

        else empty end
      ' 2>/dev/null \
    | tee "$txt"

  local pipe_status="${PIPESTATUS[0]}"   # exit code of `claude`, not jq/tee
  printf '\n'

  # Capture the final result event for the loop ledger (stop reason, error, usage).
  local result_subtype is_error num_turns
  result_subtype="$(jq -rs 'map(select(.type=="result"))|last|.subtype // "n/a"' "$raw" 2>/dev/null)"
  is_error="$(jq -rs 'map(select(.type=="result"))|last|.is_error // false' "$raw" 2>/dev/null)"
  num_turns="$(jq -rs 'map(select(.type=="result"))|last|.num_turns // "?"' "$raw" 2>/dev/null)"

  local raw_bytes
  raw_bytes="$(wc -c < "$raw" 2>/dev/null | tr -d ' ')"
  loop_log "iter $n END — claude_exit=$pipe_status result=$result_subtype is_error=$is_error turns=$num_turns raw_bytes=$raw_bytes milestone_now: $(current_milestone)"

  # --- detect stop sentinels in this iteration's assistant text ---
  if grep -q "$BLOCK_SENTINEL" "$txt" 2>/dev/null || [ -f "$BLOCKED_FILE" ]; then
    return 10   # blocked
  fi
  if grep -q "$DONE_SENTINEL" "$txt" 2>/dev/null; then
    return 20   # project complete
  fi

  # --- dead-iteration guard ---------------------------------------------------
  # A session that produced NO result event (process died mid-task) or wrote an
  # essentially-empty stream is NOT a normal iteration end. Without this the loop
  # spins through instant empty iterations, looking "blocked". Treat as hard error.
  if [ "$result_subtype" = "n/a" ] || [ "${raw_bytes:-0}" -lt 200 ]; then
    loop_log "iter $n WARN — session produced no result/empty stream (raw_bytes=$raw_bytes); treating as hard error. See $LOG_DIR/iter-$(printf '%03d' "$n").stderr"
    return 1
  fi

  # --- warn (don't stop) if the iteration produced no new commit ---
  local head_before head_after
  head_after="$(git rev-parse HEAD 2>/dev/null || echo none)"
  if [ -n "${PREV_HEAD:-}" ] && [ "$head_after" = "$PREV_HEAD" ]; then
    loop_log "iter $n WARN — no new commit this iteration"
  fi
  PREV_HEAD="$head_after"

  # Hard failure from claude itself (auth, crash). Surface but let the loop retry once.
  if [ "$pipe_status" -ne 0 ] && [ "$result_subtype" != "success" ]; then
    return 1
  fi
  return 0
}

# ----------------------------------------------------------------- main loop ---
loop_log "===== Ralph loop starting (model=$MODEL effort=$EFFORT max_iters=$MAX_ITERS) ====="
[ -f "$BLOCKED_FILE" ] && {
  notify_human "BLOCKED.md exists from a previous run. Resolve it and delete BLOCKED.md before restarting."
  exit 3
}

PREV_HEAD="$(git rev-parse HEAD 2>/dev/null || echo '')"
consecutive_fail=0
ONCE=0; [ "${1:-}" = "--once" ] && ONCE=1

for (( i=1; i<=MAX_ITERS; i++ )); do
  run_iteration "$i"
  rc=$?

  case "$rc" in
    10)  # blocked on human
      msg="$(head -c 300 "$BLOCKED_FILE" 2>/dev/null | tr '\n' ' ')"
      [ -z "$msg" ] && msg="Agent signaled it needs human input — see PROGRESS.md (## BLOCKED)."
      loop_log "BLOCKED at iter $i — stopping for human input"
      notify_human "$msg  (see BLOCKED.md / PROGRESS.md, then delete BLOCKED.md and rerun ./ralph.sh)"
      exit 3
      ;;
    20)  # done
      loop_log "PROJECT COMPLETE at iter $i 🎉"
      printf '\033[1;42m  RALPH: project complete after %d iterations. See PROGRESS.md.  \033[0m\n' "$i"
      if have notify-send; then notify-send "Ralph: project complete 🎉" "All milestones accepted after $i iterations."; fi
      exit 0
      ;;
    1)   # claude hard error
      consecutive_fail=$(( consecutive_fail + 1 ))
      loop_log "iter $i hard error (consecutive_fail=$consecutive_fail)"
      if [ "$consecutive_fail" -ge 3 ]; then
        notify_human "Claude failed 3 iterations in a row — check $LOG_DIR/*.stderr. Loop stopped."
        exit 4
      fi
      sleep 5
      ;;
    *)   # normal iteration end -> loop again fresh
      consecutive_fail=0
      ;;
  esac

  [ "$ONCE" -eq 1 ] && { loop_log "--once: stopping after one iteration"; exit 0; }
done

loop_log "Reached MAX_ITERS=$MAX_ITERS without completion. Stopping."
notify_human "Ralph hit the iteration cap ($MAX_ITERS) without finishing. Inspect PROGRESS.md and rerun to continue."
exit 5
