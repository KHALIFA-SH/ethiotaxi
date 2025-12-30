"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/requireAdmin";

export default function RatingsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [plate, setPlate] = useState("");
  const [trust, setTrust] = useState("");

  async function load() {
    try {
      setErr(null);
      const q = new URLSearchParams();
      if (plate.trim()) q.set("plate", plate.trim());
      if (trust) q.set("trustLevel", trust);

      const r = await authedFetch(`/api/ratings?${q.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to load ratings");
      setRows(j.rows || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load ratings");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Ratings</h1>
          <p style={{ color: "#667085", marginTop: 6 }}>Read-only passenger ratings (written by HTTPS function).</p>
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
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <Field label="Filter plate" value={plate} onChange={setPlate} placeholder="A-" />
          <Select label="Trust" value={trust} onChange={setTrust} options={["", "VERIFIED", "UNVERIFIED"]} />
          <button onClick={load} style={btnSecondary()}>
            Apply
          </button>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eaecf0", textAlign: "left" }}>
                <th style={th()}>Plate</th>
                <th style={th()}>Rating</th>
                <th style={th()}>Trust</th>
                <th style={th()}>Proof</th>
                <th style={th()}>TokenId</th>
                <th style={th()}>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.ratingId)} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={td()}><b>{r.plate}</b></td>
                  <td style={td()}>{r.rating}</td>
                  <td style={td()}>{r.trustLevel}</td>
                  <td style={td()}>{r.proofType}</td>
                  <td style={td()}><code>{r.tokenId || "—"}</code></td>
                  <td style={td()}>{toDate(r.createdAt) || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, color: "#667085" }}>
                    No ratings found.
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

function Select({ label, value, onChange, options }: any) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#475467", marginBottom: 6 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", border: "1px solid #d0d5dd", borderRadius: 10, padding: "10px 12px" }}
      >
        {options.map((o: string) => (
          <option key={o} value={o}>
            {o || "ALL"}
          </option>
        ))}
      </select>
    </label>
  );
}

function th(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 12, color: "#475467", fontWeight: 700 };
}
function td(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 13, color: "#101828" };
}
function btnSecondary(): React.CSSProperties {
  return { background: "white", color: "#111827", border: "1px solid #d0d5dd", padding: "10px 14px", borderRadius: 12, cursor: "pointer" };
}
