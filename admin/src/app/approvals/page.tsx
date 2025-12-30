"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/requireAdmin";

export default function ApprovalsPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [uid, setUid] = useState("");
  const [role, setRole] = useState<"DRIVER" | "ENFORCER" | "AUTHORITY" | "ADMIN">("ENFORCER");
  const [employeeId, setEmployeeId] = useState("");
  const [contractEndAt, setContractEndAt] = useState(""); // yyyy-mm-dd

  async function search() {
    try {
      setErr(null);
      const r = await authedFetch(`/api/users?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Search failed");
      setUsers(j.rows || []);
    } catch (e: any) {
      setErr(e?.message || "Search failed");
    }
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approve() {
    try {
      setErr(null);
      const millis = contractEndAt ? new Date(`${contractEndAt}T00:00:00`).getTime() : null;

      const r = await authedFetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          role,
          employeeId: employeeId || null,
          contractEndAtMillis: millis,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Approval failed");

      await search();
    } catch (e: any) {
      setErr(e?.message || "Approval failed");
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Approvals</h1>
          <p style={{ color: "#667085", marginTop: 6 }}>Assign roles + link employeeId (ENFORCER/AUTHORITY).</p>
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
          <Field label="Search (email/name/uid)" value={q} onChange={setQ} placeholder="admin@ethiotaxi.local" />
          <button onClick={search} style={btnSecondary()}>
            Search
          </button>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eaecf0", textAlign: "left" }}>
                <th style={th()}>UID</th>
                <th style={th()}>Email</th>
                <th style={th()}>Name</th>
                <th style={th()}>Role</th>
                <th style={th()}>EmployeeId</th>
                <th style={th()}>ContractEnd</th>
                <th style={th()}>Pick</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={String(u.uid)} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={td()}><code>{u.uid}</code></td>
                  <td style={td()}>{u.email || "—"}</td>
                  <td style={td()}>{u.displayName || "—"}</td>
                  <td style={td()}>{u.role || "—"}</td>
                  <td style={td()}>{u.employeeId || "—"}</td>
                  <td style={td()}>{toDate(u.contractEndAt) || "—"}</td>
                  <td style={td()}>
                    <button
                      style={btnSmall()}
                      onClick={() => {
                        setUid(u.uid);
                        setEmployeeId(u.employeeId || "");
                        setRole((u.role as any) || "ENFORCER");
                      }}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, color: "#667085" }}>
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid #eaecf0", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Approve role</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Field label="Target UID" value={uid} onChange={setUid} placeholder="Select from table" />
          <Select label="Role" value={role} onChange={(v) => setRole(v as any)} options={["DRIVER", "ENFORCER", "AUTHORITY", "ADMIN"]} />
          <Field label="Employee ID (required for ENFORCER/AUTHORITY)" value={employeeId} onChange={setEmployeeId} placeholder="1234567" />
          <Field label="Contract end (ENFORCER) yyyy-mm-dd" value={contractEndAt} onChange={setContractEndAt} placeholder="2026-12-31" />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={approve} style={btnPrimary()}>
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function toDate(v: any) {
  if (!v) return "";
  const sec = v?._seconds ?? v?.seconds;
  if (typeof sec === "number") return new Date(sec * 1000).toLocaleDateString();
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
            {o}
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
function btnPrimary(): React.CSSProperties {
  return { background: "#111827", color: "white", border: 0, padding: "10px 14px", borderRadius: 12, cursor: "pointer" };
}
function btnSecondary(): React.CSSProperties {
  return { background: "white", color: "#111827", border: "1px solid #d0d5dd", padding: "10px 14px", borderRadius: 12, cursor: "pointer" };
}
function btnSmall(): React.CSSProperties {
  return { background: "white", color: "#111827", border: "1px solid #d0d5dd", padding: "6px 10px", borderRadius: 10, cursor: "pointer", fontSize: 12 };
}
