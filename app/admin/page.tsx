"use client";

// Minimal operator console (M3). Intentionally utilitarian — the pop-brutalist theme
// lands in M9. Gated by ADMIN_SECRET, entered here and sent as the x-admin-secret header.
import { useCallback, useEffect, useState } from "react";

type Variant = { id: string; name: string; sku: string | null; stock: number };
type Drop = {
  id: string;
  name: string;
  status: string;
  totalSlots: number;
  priceUsdc: string;
  drawSeed: string | null;
  closesAt: string | null;
  variants: Variant[];
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [drops, setDrops] = useState<Drop[]>([]);
  const [log, setLog] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const headers = useCallback(
    () => ({ "content-type": "application/json", "x-admin-secret": secret }),
    [secret],
  );

  const append = (msg: string) =>
    setLog((l) => `${new Date().toISOString().slice(11, 19)}  ${msg}\n${l}`);

  const refresh = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/drops", { headers: headers() });
      if (res.status === 401) {
        append("401 unauthorized — check the secret");
        setDrops([]);
        return;
      }
      const data = await res.json();
      setDrops(data.drops ?? []);
      append(`loaded ${data.drops?.length ?? 0} drops`);
    } catch (e) {
      append(`error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [secret, headers]);

  const action = async (path: string, method = "POST", body?: unknown) => {
    setLoading(true);
    try {
      const res = await fetch(path, {
        method,
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      append(`${method} ${path} → ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
      await refresh();
    } catch (e) {
      append(`error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // no auto-load; operator types the secret then clicks Load
  }, []);

  return (
    <main style={{ maxWidth: 920, margin: "2rem auto", padding: "0 1rem", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Admin / Reset console</h1>
      <p style={{ color: "#666" }}>Operator plane (M3). Enter the admin secret to load drops.</p>

      <div style={{ display: "flex", gap: 8, margin: "1rem 0" }}>
        <input
          type="password"
          placeholder="ADMIN_SECRET"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          style={{ flex: 1, padding: 8, border: "2px solid #000" }}
        />
        <button onClick={refresh} disabled={loading || !secret} style={btn}>
          Load
        </button>
        <button
          onClick={() => action("/api/admin/seed")}
          disabled={loading || !secret}
          style={btn}
        >
          Seed demo
        </button>
      </div>

      {drops.map((d) => (
        <div key={d.id} style={{ border: "2px solid #000", padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>
              {d.name} — <span>{d.status}</span>
            </strong>
            <span>
              {d.priceUsdc} USDC · {d.totalSlots} slot(s) · seed={d.drawSeed ?? "—"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
            id={d.id} · variants: {d.variants.map((v) => v.name).join(", ") || "none"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={btnSm} onClick={() => action(`/api/admin/drops/${d.id}/open`)}>
              open
            </button>
            <button style={btnSm} onClick={() => action(`/api/admin/drops/${d.id}/close`)}>
              close
            </button>
            <button style={btnSm} onClick={() => action(`/api/admin/drops/${d.id}/settle`)}>
              settle
            </button>
            <button style={btnSm} onClick={() => action(`/api/admin/drops/${d.id}/flip`)}>
              flip coming_soon↔open
            </button>
            <button style={btnSm} onClick={() => action(`/api/admin/drops/${d.id}/reset`)}>
              reset
            </button>
            <button
              style={btnSm}
              onClick={() => {
                const seed = prompt("RNG seed (blank to clear):") ?? "";
                action(`/api/admin/drops/${d.id}/seed`, "POST", { seed: seed || null });
              }}
            >
              set seed
            </button>
            <button
              style={btnSm}
              onClick={() =>
                action(`/api/admin/drops/${d.id}/dummy-entry`, "POST", {
                  humanKey: `dummy-${Math.random().toString(36).slice(2, 8)}`,
                })
              }
            >
              + dummy entry
            </button>
          </div>
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Log</h2>
      <pre style={{ background: "#111", color: "#0f0", padding: 12, whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto" }}>
        {log || "(no actions yet)"}
      </pre>
    </main>
  );
}

const btn: React.CSSProperties = {
  padding: "8px 14px",
  border: "2px solid #000",
  background: "#c6ff00",
  fontWeight: 700,
  cursor: "pointer",
};
const btnSm: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid #000",
  background: "#fff",
  cursor: "pointer",
  fontSize: 12,
};
