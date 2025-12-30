"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { requireAdmin } from "@/lib/adminGate";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stations", label: "Stations" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/employees", label: "Employees" },
  { href: "/enforcer-approvals", label: "Enforcer Approvals" },
  { href: "/config", label: "Config" },
  { href: "/audit-logs", label: "Audit Logs" }
];

export default function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/sign-in");
        return;
      }
      const res = await requireAdmin(user);
      if (!res.ok) {
        await auth.signOut();
        router.replace("/sign-in");
        return;
      }
      setEmail(res.email || "");
    });

    return () => unsub();
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Top header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 16,
          borderBottom: "1px solid #eee"
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "#000",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 700
            }}
          >
            ET
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>EthioTaxi Admin</div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {email ? `${email} (ADMIN)` : ""}
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            await auth.signOut();
            router.replace("/sign-in");
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff"
          }}
        >
          Sign out
        </button>
      </div>

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr" }}>
        {/* Left nav */}
        <div style={{ padding: 16, borderRight: "1px solid #eee" }}>
          <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 12 }}>
            {nav.map((n) => {
              const active = path === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  style={{
                    display: "block",
                    padding: "10px 12px",
                    borderRadius: 10,
                    marginBottom: 6,
                    textDecoration: "none",
                    color: "#000",
                    background: active ? "#000" : "transparent",
                    colorScheme: "light",
                    ...(active ? { color: "#fff" } : {})
                  }}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Main */}
        <div style={{ padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{title}</h1>
          <div style={{ marginTop: 16 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
