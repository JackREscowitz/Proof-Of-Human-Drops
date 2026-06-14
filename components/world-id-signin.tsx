"use client";

// Header "Sign in with World ID" control. The user scans World App ONCE here (against the
// global `signin` action); on success we open a session cookie and every drop's Join button
// becomes one tap with no re-scan. When already signed in, shows the human-key fingerprint
// + a Sign out button.
//
// Mirrors the IDKit v4 flow in world-id-entry.tsx: fetch a server-signed rp_context for the
// sign-in action → open IDKitRequestWidget → POST the result to /api/auth/signin.
import { useCallback, useState } from "react";
import {
  IDKitRequestWidget,
  proofOfHuman,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { useSession } from "@/components/session-provider";

interface SigninContext {
  rp_context: RpContext;
  app_id: `app_${string}`;
  action: string;
}

export function WorldIdSignin() {
  const { signedIn, verificationLvl, humanKeyShort, loading, refresh, signOut } =
    useSession();
  const [phase, setPhase] = useState<"idle" | "preparing" | "verifying" | "submitting">(
    "idle",
  );
  const [error, setError] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<SigninContext | null>(null);

  // Step 1: ask the backend for a signed rp_context for the sign-in action, then open IDKit.
  const begin = useCallback(async () => {
    setError("");
    setPhase("preparing");
    try {
      const res = await fetch("/api/auth/signin-context", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `could not start sign-in (${res.status})`);
      }
      const data = (await res.json()) as SigninContext;
      setConfig(data);
      setPhase("verifying");
      setOpen(true);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "could not start sign-in");
    }
  }, []);

  // Step 3: widget produced a proof → verify + open the session server-side.
  const submit = useCallback(
    async (result: IDKitResult) => {
      setPhase("submitting");
      try {
        const res = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idkitResult: result }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.detail || body.error || `sign-in failed (${res.status})`);
        }
        await refresh();
        setPhase("idle");
      } catch (err) {
        setPhase("idle");
        setError(err instanceof Error ? err.message : "sign-in failed");
      }
    },
    [refresh],
  );

  const busy = phase !== "idle";

  // --- Signed in: show fingerprint + sign out -------------------------------
  if (signedIn) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="pill bg-lime"
          title={`Verified human${verificationLvl ? ` · ${verificationLvl}` : ""}`}
        >
          ✓ {verificationLvl === "orb" ? "Orb-verified" : "Verified"}
          {humanKeyShort ? ` · ${humanKeyShort}` : ""}
        </span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="border-[3px] border-ink bg-white px-3 py-1.5 text-xs font-extrabold uppercase brutal-hover"
        >
          Sign out
        </button>
      </div>
    );
  }

  // --- Not signed in: the sign-in CTA ---------------------------------------
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={begin}
        disabled={busy || loading}
        className="inline-flex items-center gap-2 border-[3px] border-ink bg-ink px-4 py-2 text-xs font-extrabold uppercase text-cream brutal-hover disabled:opacity-60 sm:text-sm"
      >
        {phase === "preparing"
          ? "Preparing…"
          : phase === "verifying"
            ? "Verify in World App…"
            : phase === "submitting"
              ? "Signing in…"
              : "Sign in with World ID"}
      </button>
      {error && <span className="text-[11px] font-bold text-destructive">{error}</span>}

      {config && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o && (phase === "verifying" || phase === "preparing")) setPhase("idle");
          }}
          app_id={config.app_id}
          action={config.action}
          rp_context={config.rp_context}
          allow_legacy_proofs={true}
          preset={proofOfHuman({ signal: "" })}
          onSuccess={submit}
          onError={(code) => {
            setPhase("idle");
            setError(`World ID error: ${code}`);
          }}
        />
      )}
    </div>
  );
}
