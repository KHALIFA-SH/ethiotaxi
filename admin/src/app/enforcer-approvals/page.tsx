"use client";

import { useState } from "react";
import { AuthGate } from "@/app/_components/AuthGate";
import { AppShell } from "@/app/_components/AppShell";
import { apiGet, apiPost } from "@/lib/apiClient";

type UserRow = { uid: string; email?: string | null; displayName?: string | null; roles?: any; employeeId?: string | null };

export default function EnforcerApprovalsPage() {
  const [q, setQ] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [results, setResults] = useState<UserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    setErr(null);
    setBusy(true);
    try {
      const res = await apiGet<{ users: UserRow[] }>(`/api/users/search?q=${encodeURIComponent(q.trim())}`);
      setResults(res.users);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function approve(uid: string) {
    if (!employeeId.trim()) { setErr("employeeId is required"); return; }
    setErr(null);
    setBusy(true);
    try {
      await apiPost("/api/enforcers/approve", { uid, employeeId: employeeId.trim() });
      await search();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <AppShell>
        <div className="rounded-xl border bg-white p-6">
          <div className="text-xl font-semibold">Enforcer Approvals</div>
          <div className="mt-1 text-sm text-gray-500">Search users and promote to ENFORCER by linking employeeId.</div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
            <input className="w-full rounded-lg border px-3 py-2 md:w-96" placeholder="Search by uid/email/name" value={q} onChange={(e) => setQ(e.target.value)} />
            <input className="w-full rounded-lg border px-3 py-2 md:w-56" placeholder="employeeId to link" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
            <button className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50" onClick={search} disabled={busy}>
              {busy ? "Searching…" : "Search"}
            </button>
          </div>

          {err && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}

          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-3">UID</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Roles</th>
                  <th className="py-2 pr-3">EmployeeId</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((u) => (
                  <tr key={u.uid} className="border-b">
                    <td className="py-2 pr-3 font-mono text-xs">{u.uid}</td>
                    <td className="py-2 pr-3">{u.email || "—"}</td>
                    <td className="py-2 pr-3">{u.displayName || "—"}</td>
                    <td className="py-2 pr-3">{JSON.stringify(u.roles || {})}</td>
                    <td className="py-2 pr-3">{u.employeeId || "—"}</td>
                    <td className="py-2 pr-3 text-right">
                      <button className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50" onClick={() => approve(u.uid)} disabled={busy}>
                        Approve ENFORCER
                      </button>
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr><td className="py-3 text-sm text-gray-500" colSpan={6}>No results.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
