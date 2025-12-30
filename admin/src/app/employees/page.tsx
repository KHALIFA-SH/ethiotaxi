"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/requireAdmin";

export default function EmployeesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [staffType, setStaffType] = useState<"ENFORCER" | "AUTHORITY">("ENFORCER");
  const [status, setStatus] = useState("ACTIVE");
  const [contractEndAt, setContractEndAt] = useState(""); // yyyy-mm-dd

  async function load() {
    try {
      setErr(null);
      const r = await authedFetch("/api/employees");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to load employees");
      setRows(j.rows || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load employees");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      setErr(null);
      const millis = contractEndAt ? new Date(`${contractEndAt}T00:00:00`).getTime() : null;

      const r = await authedFetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          staffType,
          status,
          contractEndAtMillis: millis,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to save employee");

      setEmployeeId("");
      setContractEndAt("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to save employee");
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Employees</h1>
          <p style={{ color: "#667085", marginTop: 6 }}>Manage ENFORCER and AUTHORITY staff (employeeCredentials).</p>
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
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create / Update Employee</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Field label="Employee ID" value={employeeId} onChange={setEmployeeId} placeholder="1234567" />
          <Select label="Staff type" value={staffType} onChange={(v) => setStaffType(v as any)} options={["ENFORCER", "AUTHORITY"]} />
          <Field label="Status" value={status} onChange={setStatus} placeholder="ACTIVE" />
          <Field label="Contract end (ENFORCER) yyyy-mm-dd" value={contractEndAt} onChange={setContractEndAt} placeholder="2026-12-31" />
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={save} style={btnPrimary()}>
            Save employee
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid #eaecf0", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Employees (latest first)</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #eaecf0", textAlign: "left" }}>
                <th style={th()}>Employee ID</th>
                <th style={th()}>Staff type</th>
                <th style={th()}>Status</th>
                <th style={th()}>Contract end</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r.employeeId)} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={td()}><b>{r.employeeId}</b></td>
                  <td style={td()}>{r.staffType}</td>
                  <td style={td()}>{r.status}</td>
                  <td style={td()}>{toDate(r.contractEndAt) || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, color: "#667085" }}>
                    No employees yet.
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
