"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stations", label: "Stations" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/employees", label: "Employees" },
  { href: "/enforcer-approvals", label: "Enforcer Approvals" },
  { href: "/config", label: "Config" },
  { href: "/audit-logs", label: "Audit Logs" }
];

export default function AdminNav() {
  const path = usePathname();

  return (
    <div style={{ borderBottom: "1px solid #eee", marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 12, padding: 12, flexWrap: "wrap" }}>
        {items.map((it) => {
          const active = path === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #ddd",
                textDecoration: "none",
                background: active ? "#f3f3f3" : "white"
              }}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
