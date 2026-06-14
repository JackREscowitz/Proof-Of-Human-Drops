"use client";

// Client purchase island for the /win/[entryId] winner page (M12). The server component
// renders the static winner context (product, finish, price); this handles the interactive
// "PURCHASE — pay USDC" click and the post-purchase success state.
//
// On click → POST /api/drops/:id/purchase (the SAME route the inline web flow + agent path
// use; it resolves the winner's wallet SERVER-SIDE from entry.wallet_address — human demo
// wallet for web entries, the agent's wallet for agent entries — so it works for WHOEVER won).
// Real USDC settles on chain 4801; we surface the real tx hash + explorer link.
//
// If the entry is already `purchased` when the page loads, the server passes the existing
// tx in and we render the confirmed state immediately (no button).

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "ready" | "purchasing" | "purchased" | "error";

export default function WinnerPurchase({
  dropId,
  entryId,
  priceUsdc,
  initialTxHash = null,
  initialExplorerUrl = null,
}: {
  dropId: string;
  entryId: string;
  priceUsdc: string;
  initialTxHash?: string | null;
  initialExplorerUrl?: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    initialTxHash ? "purchased" : "ready",
  );
  const [txHash, setTxHash] = useState<string | null>(initialTxHash);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(
    initialExplorerUrl,
  );
  const [error, setError] = useState<string>("");

  const purchase = useCallback(async () => {
    setPhase("purchasing");
    setError("");
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
      setPhase("purchased");
      // Refresh the server component so a reload/back shows the persisted `purchased` state.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "purchase failed");
      setPhase("error");
    }
  }, [dropId, entryId, router]);

  if (phase === "purchased") {
    return (
      <div className="brutal-lime flex flex-col gap-4 p-6">
        <div className="display text-4xl sm:text-5xl">PURCHASED ✓</div>
        <p className="text-sm font-bold uppercase">
          {priceUsdc} USDC settled on World Chain Sepolia (chain 4801) — real
          on-chain transfer.
        </p>
        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 border-[3px] border-ink bg-white px-6 py-3 text-base font-extrabold uppercase brutal-hover"
          >
            View transaction ↗
          </a>
        )}
        {txHash && (
          <code className="break-all font-mono text-xs text-muted-foreground">
            {txHash}
          </code>
        )}
      </div>
    );
  }

  return (
    <div className="brutal-lime flex flex-col gap-4 p-6">
      <div className="display text-5xl sm:text-6xl">YOU WON ✦</div>
      <p className="text-base font-bold uppercase">
        One slot reserved for you. Pay {priceUsdc} USDC to claim it — real
        settlement on chain 4801.
      </p>
      <button
        onClick={purchase}
        disabled={phase === "purchasing"}
        className="inline-flex w-fit items-center gap-2 border-[3px] border-ink bg-ink px-8 py-4 text-lg font-extrabold uppercase text-cream brutal-hover disabled:opacity-60"
      >
        {phase === "purchasing"
          ? "Settling USDC…"
          : "Purchase — pay USDC ↗"}
      </button>
      {error && <p className="text-sm font-bold text-destructive">{error}</p>}
    </div>
  );
}
