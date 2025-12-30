"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRequireSession } from "@/lib/useSession";
import { authedFetch, safeJson } from "@/lib/requireAdmin";

type AuditRow = {
  id?: string;
  ts?: any;
  action?: string;
  actorUid?: string;
  stationId?: string;
  plate?: string;
  tapela?: string;
  target?: string;
  meta?: any;
};

function toDate(v: any) {
  if (!v) return "";
  const sec = v?._seconds ?? v?.seconds;
  if (typeof sec === "number") return new Date(sec * 1000).toLocaleString();
  if (typeof v === "string") return v;
  return "";
}

export default function AuditLogsPage() {
  const { session, loading } = useRequireSession();

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [stationId, setStationId] = useState("");
  const [plate, setPlate] = useState("");
  const [tapela, setTapela] = useState("");
  const [actorUid, setActorUid] = useState("");
  const [action, setAction] = useState("");

  async function load() {
    try {
      setErr(null);
      const q = new URLSearchParams();
      q.set("limit", "300");
      const r = await authedFetch(`/api/audit?${q.toString()}`);
      const j = await safeJson(r);
      if (!r.ok) throw new Error(j?.error || "Failed to load audit logs");

      const list: AuditRow[] = Array.isArray(j?.rows) ? j.rows : [];
      setRows(list);
    } catch (e: any) {
      setRows([]); // ✅ never leave undefined
      setErr(e?.message || "Failed to load audit logs");
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!session) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session?.uid]);

  const filtered = useMemo(() => {
    const s = stationId.trim();
    const p = plate.trim().toUpperCase();
    const t = tapela.trim().toUpperCase();
    const a = actorUid.trim();
    const ac = action.trim().toLowerCase();

    const items = Array.isArray(rows) ? rows : []; // ✅ always safe

    return items.filter((x) => {
      if (s && String(x.stationId || "") !== s) return false;
      if (p && String(x.plate || "").toUpperCase() !== p) return false;
      if (t && String(x.tapela || "").toUpperCase() !== t) return false;
      if (a && String(x.actorUid || "") !== a) return false;
      if (ac && String(x.action || "").toLowerCase().indexOf(ac) === -1) return false;
      return true;
    });
  }, [rows, stationId, plate, tapela, actorUid, action]);

  if (loading) return <div style={{ padding: 18 }}>Loading…</div>;
  if (!session) return null;

  return (
    <div style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900 }}>Audit Logs</h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            Filter by station, plate, tapela (legacy), actor, or action.
          </p>
        </div>
        <Link href="/dashboard" style={{ color: "#475467", textDecoration: "none" }}>
          ← Dashboard
        </Link>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #fda29b",
            background: "#fffbfa",
            borderRadius: 12,
            color: "#b42318",
          }}
        >
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          <Input label="StationId" value={stationId} onChange={setStationId} placeholder="MEGENAGNA" />
          <Input label="Plate" value={plate} onChange={setPlate} placeholder="A-12345" />
          <Input label="Tapela (legacy)" value={tapela} onChange={setTapela} placeholder="tapela" />
          <Input label="Actor UID" value={actorUid} onChange={setActorUid} placeholder="uid" />
          <Input label="Action contains" value={action} onChange={setAction} placeholder="admin:upsertVehicle" />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={load} style={btnSecondary()}>
            Refresh
          </button>
          <div style={{ color: "var(--muted)", fontSize: 13, alignSelf: "center" }}>
            Showing <b>{filtered.length}</b> records
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={th()}>Time</th>
                <th style={th()}>Action</th>
                <th style={th()}>Actor</th>
                <th style={th()}>Station</th>
                <th style={th()}>Plate</th>
                <th style={th()}>Tapela</th>
                <th style={th()}>Target</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={r.id || `${r.action}-${idx}`} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={td()}>{toDate(r.ts) || "—"}</td>
                  <td style={td()}><code>{r.action || "—"}</code></td>
                  <td style={td()}>{r.actorUid || "—"}</td>
                  <td style={td()}>{r.stationId || "—"}</td>
                  <td style={td()}>{r.plate || "—"}</td>
                  <td style={td()}>{r.tapela || "—"}</td>
                  <td style={td()}>{r.target || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, color: "var(--muted)" }}>
                    No audit logs.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#475467", marginBottom: 6, fontWeight: 700 }}>{label}</div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", border: "1px solid #d0d5dd", borderRadius: 10, padding: "10px 12px" }}
      />
    </label>
  );
}

function th(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 12, color: "#475467", fontWeight: 800 };
}
function td(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 13, color: "#101828" };
}
function btnSecondary(): React.CSSProperties {
  return {
    background: "white",
    color: "#111827",
    border: "1px solid #d0d5dd",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 800,
  };
}