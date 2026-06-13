"use client";

// World ID v4 entry + winner-purchase flow (M9). Drives the full web Sybil-gated journey:
//   1. fetch a server-signed rp_context for this drop's action (/api/worldid/rp-context)
//   2. open the IDKit v4 widget (proof-of-human, with legacy orb fallback)
//   3. on success, POST the IDKitResult to /api/drops/:id/enter to verify + dedupe →
//      capture the returned entry id
//   4. poll /api/drops/:id/entry-status for the draw result
//   5. when 'won', show the "YOU WON — PURCHASE" CTA → POST /api/drops/:id/purchase
//      (real USDC settlement on chain 4801) → success state w/ explorer link
//
// The signing wallet for the web winner is the "human" demo wallet, resolved server-side
// from the entry's stored wallet_address (set at /enter time) — keys never cross the wire.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  IDKitRequestWidget,
  proofOfHuman,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";

type EntryState =
  | "idle"
  | "preparing"
  | "verifying"
  | "submitting"
  | "entered" // in the draw, pending
  | "already-entered"
  | "won" // drawn, this human won — can purchase
  | "lost" // drawn, did not win
  | "purchasing" // settling USDC
  | "purchased" // bought, tx confirmed
  | "expired"
  | "error";

interface RpContextResponse {
  rp_context: RpContext;
  app_id: `app_${string}`;
  action: string;
}

const PENDING_STATES: EntryState[] = ["entered", "already-entered"];

export function WorldIdEntry({
  dropId,
  variantId,
  disabled,
}: {
  dropId: string;
  variantId?: string | null;
  disabled?: boolean;
}) {
  const [state, setState] = useState<EntryState>("idle");
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<RpContextResponse | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 1: ask the backend for a signed rp_context, then open the widget.
  const begin = useCallback(async () => {
    setState("preparing");
    setMessage("");
    try {
      const res = await fetch("/api/worldid/rp-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dropId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `failed to prepare verification (${res.status})`);
      }
      const data = (await res.json()) as RpContextResponse;
      setConfig(data);
      setState("verifying");
      setOpen(true);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "could not start verification");
    }
  }, [dropId]);

  // Step 3: the widget produced a proof — verify + record it server-side.
  const submitProof = useCallback(
    async (result: IDKitResult) => {
      setState("submitting");
      try {
        const res = await fetch(`/api/drops/${dropId}/enter`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idkitResult: result, variantId: variantId ?? undefined }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.detail || body.error || `entry failed (${res.status})`);
        }
        if (body.alreadyEntered) {
          setState("already-entered");
          setMessage("You're already entered in this drop.");
        } else {
          setEntryId(body.entry?.id ?? null);
          setState("entered");
          setMessage("You're in! One slot reserved for this verified human.");
        }
      } catch (err) {
        setState("error");
        setMessage(err instanceof Error ? err.message : "entry failed");
      }
    },
    [dropId, variantId],
  );

  // Step 4: once we hold an entry id and are pending, poll the draw result.
  useEffect(() => {
    if (!entryId || !PENDING_STATES.includes(state)) return;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/drops/${dropId}/entry-status?entryId=${encodeURIComponent(entryId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const body = await res.json();
        if (body.status === "won") {
          setState("won");
          setMessage("You won a slot. Purchase your Mac Mini below.");
        } else if (body.status === "lost") {
          setState("lost");
          setMessage("This drop was drawn — you weren't selected this time.");
        } else if (body.status === "purchased") {
          setState("purchased");
        } else if (body.status === "expired") {
          setState("expired");
          setMessage("Your purchase window expired.");
        }
      } catch {
        // transient — keep polling
      }
    };
    pollRef.current = setInterval(poll, 4000);
    void poll();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [entryId, state, dropId]);

  // Step 5: the winner exercises the purchase → real USDC settlement.
  const purchase = useCallback(async () => {
    if (!entryId) return;
    setState("purchasing");
    setMessage("");
    try {
      const res = await fetch(`/api/drops/${dropId}/purchase`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `purchase failed (${res.status})`);
      }
      setTxHash(body.txHash ?? null);
      setExplorerUrl(body.explorerUrl ?? null);
      setState("purchased");
    } catch (err) {
      setState("won"); // back to the CTA so they can retry
      setMessage(err instanceof Error ? err.message : "purchase failed");
    }
  }, [dropId, entryId]);

  const busy =
    state === "preparing" || state === "verifying" || state === "submitting";

  // --- Render the right block for each state ---------------------------------

  if (state === "purchased") {
    return (
      <div className="brutal-lime flex flex-col gap-3 p-5">
        <div className="display text-3xl">PURCHASED ✓</div>
        <p className="text-sm font-bold uppercase">
          Real USDC settled on World Chain Sepolia (4801).
        </p>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1 border-[3px] border-ink bg-white px-4 py-2 text-sm font-extrabold uppercase brutal-hover"
          >
            View tx ↗
          </a>
        )}
        {txHash && (
          <code className="break-all font-mono text-xs">{txHash}</code>
        )}
      </div>
    );
  }

  if (state === "won" || state === "purchasing") {
    return (
      <div className="brutal-lime flex flex-col gap-3 p-5">
        <div className="display text-3xl">YOU WON ✦</div>
        <p className="text-sm font-bold uppercase">
          One slot reserved for you. Pay to claim it.
        </p>
        <button
          onClick={purchase}
          disabled={state === "purchasing"}
          className="inline-flex w-fit items-center gap-2 border-[3px] border-ink bg-ink px-7 py-4 text-lg font-extrabold uppercase text-cream brutal-hover disabled:opacity-60"
        >
          {state === "purchasing" ? "Settling USDC…" : "Purchase — pay USDC ↗"}
        </button>
        {message && <p className="text-sm font-bold text-destructive">{message}</p>}
      </div>
    );
  }

  if (state === "lost") {
    return (
      <div className="brutal flex flex-col gap-1 p-5">
        <div className="display text-2xl">NOT SELECTED</div>
        <p className="text-sm font-medium">{message}</p>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <div className="brutal flex flex-col gap-1 p-5">
        <div className="display text-2xl">WINDOW EXPIRED</div>
        <p className="text-sm font-medium">{message}</p>
      </div>
    );
  }

  if (state === "entered" || state === "already-entered") {
    return (
      <div className="brutal-lime flex flex-col gap-2 p-5">
        <div className="display text-2xl">
          {state === "already-entered" ? "ALREADY ENTERED" : "YOU'RE IN ✓"}
        </div>
        <p className="text-sm font-bold uppercase">
          One slot reserved for this verified human. Awaiting the draw…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={begin}
        disabled={disabled || busy}
        data-state={state}
        className="inline-flex items-center justify-center gap-2 border-[3px] border-ink bg-lime px-7 py-4 text-lg font-extrabold uppercase text-ink brutal-hover disabled:opacity-60"
      >
        {state === "preparing"
          ? "Preparing…"
          : state === "verifying"
            ? "Verify in World App…"
            : state === "submitting"
              ? "Recording entry…"
              : "Verify with World ID to enter"}
      </button>

      {message && (
        <p
          className={
            state === "error"
              ? "text-sm font-bold text-destructive"
              : "text-sm font-medium text-muted-foreground"
          }
        >
          {message}
        </p>
      )}

      {config && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o && (state === "verifying" || state === "preparing")) {
              setState("idle");
            }
          }}
          app_id={config.app_id}
          action={config.action}
          rp_context={config.rp_context}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal: variantId ?? dropId })}
          onSuccess={submitProof}
          onError={(code) => {
            setState("error");
            setMessage(`World ID error: ${code}`);
          }}
        />
      )}
    </div>
  );
}
