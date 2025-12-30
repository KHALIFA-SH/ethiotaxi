"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireSession } from "@/lib/useSession";
import { authedFetch, safeJson } from "@/lib/requireAdmin";
import { ConfirmModal } from "@/components/ConfirmModal";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { session, loading } = useRequireSession();
  const [summary, setSummary] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const r = await authedFetch("/api/summary");
        const j = await safeJson(r);
        if (!r.ok) throw new Error(j?.error || "Failed to load summary");
        setSummary(j);
      } catch (e: any) {
        setErr(e?.message || "Failed to load summary");
      }
    })();
  }, []);

  async function doSignOut() {
    await fetch("/api/session", { method: "DELETE", credentials: "include" });
    try {
      await signOut(auth);
    } catch {}
    router.replace("/sign-in");
  }

  if (loading) return <div style={{ padding: 18 }}>Loading…</div>;
  if (!session) return null;

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <ConfirmModal
        open={confirmOut}
        title="Sign out?"
        message="You will be signed out and will need to sign in again to access the admin portal."
        confirmText="Sign out"
        destructive
        onClose={() => setConfirmOut(false)}
        onConfirm={async () => {
          setConfirmOut(false);
          await doSignOut();
        }}
      />

      <TopBar email={session.email || ""} onSignOut={() => setConfirmOut(true)} />

      <h1 style={{ fontSize: 20, fontWeight: 900, marginTop: 14 }}>Dashboard</h1>
      <p style={{ color: "var(--muted)", marginTop: 6 }}>Admin portal is ready.</p>

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 14 }}>
        <Card title="Vehicles" value={String(summary?.counts?.vehicles ?? "—")} href="/vehicles" />
        <Card title="Employees" value={String(summary?.counts?.employees ?? "—")} href="/employees" />
        <Card title="Stations" value={String(summary?.counts?.stations ?? "—")} href="/stations" />
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <NavCard href="/vehicles" title="Vehicles" desc="Create/update/link drivers." />
        <NavCard href="/employees" title="Employees" desc="Manage enforcers/authority employees." />
        <NavCard href="/stations" title="Stations" desc="Station list and queue overview." />
        <NavCard href="/config" title="Config" desc="Edit app settings." />
        <NavCard href="/audit-logs" title="Audit Logs" desc="View sensitive actions." />
      </div>
    </div>
  );
}

function TopBar({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "var(--brand)",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
          }}
        >
          ET
        </div>
        <div>
          <div style={{ fontWeight: 900 }}>EthioTaxi Admin</div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{email || "—"}</div>
        </div>
      </div>
      <button onClick={onSignOut} style={btnSecondary()}>
        Sign out
      </button>
    </div>
  );
}

function Card({ title, value, href }: { title: string; value: string; href: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 16, padding: 14 }}>
        <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{value}</div>
      </div>
    </Link>
  );
}

function NavCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 16, padding: 14 }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>{desc}</div>
      </div>
    </Link>
  );
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