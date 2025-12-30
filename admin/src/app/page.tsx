import Link from "next/link";

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "min(560px, 100%)", background: "white", border: "1px solid var(--border)", borderRadius: 18, padding: 20, boxShadow: "0 10px 30px rgba(16,24,40,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--brand)", display: "grid", placeItems: "center", color: "white", fontWeight: 900 }}>
            ET
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>EthioTaxi Admin</div>
            <div style={{ color: "var(--muted)", marginTop: 2 }}>Governance portal for stations, vehicles, employees, and audit.</div>
          </div>
        </div>

        <div style={{ marginTop: 16, color: "var(--muted)", lineHeight: 1.5 }}>
          Please sign in to continue. Access requires allowlist email or ADMIN claim.
        </div>

        <div style={{ marginTop: 16 }}>
          <Link href="/sign-in" style={{ display: "inline-block", textDecoration: "none", background: "var(--brand)", color: "white", padding: "10px 14px", borderRadius: 12, fontWeight: 800 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}