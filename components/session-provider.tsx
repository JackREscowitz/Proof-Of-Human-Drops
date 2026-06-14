"use client";

// Client-side session context for "sign in once with World ID, then 1-tap join raffles".
// Holds whether the visitor is signed in (from /api/auth/me) so the header sign-in control
// and every drop's Join button can share one source of truth and re-render together when
// the session changes.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface SessionState {
  signedIn: boolean;
  verificationLvl: "orb" | "device" | null;
  humanKeyShort: string | null;
  // true until the first /api/auth/me resolves (so buttons can avoid flicker).
  loading: boolean;
  // re-fetch /api/auth/me (call after sign-in / sign-out).
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [verificationLvl, setVerificationLvl] = useState<"orb" | "device" | null>(null);
  const [humanKeyShort, setHumanKeyShort] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const body = (await res.json()) as {
        signedIn: boolean;
        verificationLvl?: "orb" | "device" | null;
        humanKeyShort?: string | null;
      };
      setSignedIn(!!body.signedIn);
      setVerificationLvl(body.verificationLvl ?? null);
      setHumanKeyShort(body.humanKeyShort ?? null);
    } catch {
      // network blip — leave current state
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      setSignedIn(false);
      setVerificationLvl(null);
      setHumanKeyShort(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider
      value={{ signedIn, verificationLvl, humanKeyShort, loading, refresh, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
