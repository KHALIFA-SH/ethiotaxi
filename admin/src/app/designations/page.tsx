"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/requireAdmin";

export default function DesignationsPage() {
  const [openRows, setOpenRows] = useState<any[]>([]);
  const [checks, setChecks] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [plate, setPlate] = useState("");
  const [targetStationId, setTargetStationId] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    try {
      setErr(null);
      const r1 = await authedFetch("/api/designations?status=OPEN");
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1?.error || "Failed to load designations");
      setOpenRows(j1.rows || []);

      const r2 = await authedFetch("/api/designation-checks");
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(j2?.error || "Failed to load checks");
      setChecks(j2.rows || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    try {
      setErr(null);
      const r = await authedFetch("/api/designations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate, targetStationId, note }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Create failed");
      setPlate("");
      setTargetStationId("");
      setNote("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    }
  }

  async function close(designationId: string) {
    try {
      setErr(null);
      const r = await authedFetch("/api/designations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", designationId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Close failed");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Close failed");
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Designations</h1>
          <p style={{ color: "#667085", marginTop: 6 }}>Authority governance: plate → target station. Enforcers record checks.</p>
        </div>
        <Link href="/dashboard" style={{ color: "#475467", textDecoration: "none" }}>
          ← Dashboard
        </Link>
      </div>

      {err ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #fda29b", background: "#fffbfa", borderRadius: 12, color: "#b42318" }}>
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 14, border: "1px solid #eaecf0", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create designation (for demo: admin can create)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <Field label="Plate" value={plate} onChange={setPlate} placeholder="A-12345" />
          <Field label="Target Station ID" value={targetStationId} onChange={setTargetStationId} placeholder="MEGENAGNA" />
          <Field label="Note (optional)" value={note} onChange={setNote} />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={create} style={btnPrimary()}>
            Create
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid #eaecf0", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Open designations</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eaecf0", textAlign: "left" }}>
                <th style={th()}>Plate</th>
                <th style={th()}>TargetStation</th>
                <th style={th()}>Created</th>
                <th style={th()}>CreatedBy</th>
                <th style={th()}>Action</th>
              </tr>
            </thead>
            <tbody>
              {openRows.map((r) => (
                <tr key={String(r.designationId)} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={td()}><b>{r.plate}</b></td>
                  <td style={td()}>{r.targetStationId}</td>
                  <td style={td()}>{toDate(r.createdAt) || "—"}</td>
                  <td style={td()}><code>{r.createdByAuthorityUid || "—"}</code></td>
                  <td style={td()}>
                    <button style={btnSmall()} onClick={() => close(r.designationId)}>
                      Close
                    </button>
                  </td>
                </tr>
              ))}
              {openRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: "#667085" }}>
                    No open designations.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid #eaecf0", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Designation checks (latest)</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eaecf0", textAlign: "left" }}>
                <th style={th()}>Plate</th>
                <th style={th()}>Station</th>
                <th style={th()}>Result</th>
                <th style={th()}>CheckedAt</th>
                <th style={th()}>Enforcer</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={String(c.checkId)} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={td()}>{c.plate}</td>
                  <td style={td()}>{c.stationId}</td>
                  <td style={td()}><b>{c.result}</b></td>
                  <td style={td()}>{toDate(c.checkedAt) || "—"}</td>
                  <td style={td()}><code>{c.checkedByEnforcerUid || "—"}</code></td>
                </tr>
              ))}
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: "#667085" }}>
                    No checks yet.
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

function toDate(v: any) {
  if (!v) return "";
  const sec = v?._seconds ?? v?.seconds;
  if (typeof sec === "number") return new Date(sec * 1000).toLocaleString();
  if (typeof v === "string") return v;
  return "";
}

function Field({ label, value, onChange, placeholder }: any) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#475467", marginBottom: 6 }}>{label}</div>
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
  return { padding: "10px 10px", fontSize: 12, color: "#475467", fontWeight: 700 };
}
function td(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 13, color: "#101828" };
}
function btnPrimary(): React.CSSProperties {
  return { background: "#111827", color: "white", border: 0, padding: "10px 14px", borderRadius: 12, cursor: "pointer" };
}
function btnSmall(): React.CSSProperties {
  return { background: "white", color: "#111827", border: "1px solid #d0d5dd", padding: "6px 10px", borderRadius: 10, cursor: "pointer", fontSize: 12 };
}
