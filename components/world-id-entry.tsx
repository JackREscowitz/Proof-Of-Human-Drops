"use client";

// World ID v4 entry button (M4). Drives the web Sybil-gated entry flow:
//   1. fetch a server-signed rp_context for this drop's action (/api/worldid/rp-context)
//   2. open the IDKit v4 widget (proof-of-human, with legacy orb fallback)
//   3. on success, POST the IDKitResult to /api/drops/:id/enter to verify + dedupe
//
// The full pop-brutalist styling is M9; this is functional UI for the M4 acceptance gate.
import { useCallback, useState } from "react";
import {
  IDKitRequestWidget,
  proofOfHuman,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { Button } from "@/components/ui/button";

type EntryState =
  | "idle"
  | "preparing"
  | "verifying"
  | "submitting"
  | "entered"
  | "already-entered"
  | "error";

interface RpContextResponse {
  rp_context: RpContext;
  app_id: `app_${string}`;
  action: string;
}

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

  const busy =
    state === "preparing" || state === "verifying" || state === "submitting";

  return (
    <div className="flex flex-col gap-2">
      {state === "entered" || state === "already-entered" ? (
        <div
          className="border-2 border-black bg-lime-300 px-4 py-3 font-bold uppercase text-black"
          data-state={state}
        >
          {state === "already-entered" ? "ALREADY ENTERED" : "ENTERED ✓"}
        </div>
      ) : (
        <Button
          onClick={begin}
          disabled={disabled || busy}
          data-state={state}
          className="text-base font-bold uppercase"
        >
          {state === "preparing"
            ? "Preparing…"
            : state === "verifying"
              ? "Verify in World App…"
              : state === "submitting"
                ? "Recording entry…"
                : "Verify with World ID to enter"}
        </Button>
      )}

      {message && (
        <p
          className={
            state === "error"
              ? "text-sm font-medium text-red-600"
              : "text-sm text-zinc-600 dark:text-zinc-400"
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
            // If the user closes the widget without finishing, return to idle.
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
