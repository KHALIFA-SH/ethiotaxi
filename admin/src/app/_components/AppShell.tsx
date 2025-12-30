"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useAuthz } from "@/lib/useAuthz";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stations", label: "Stations" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/employees", label: "Employees" },
  { href: "/enforcer-approvals", label: "Enforcer Approvals" },
  { href: "/config", label: "Config" },
  { href: "/audit-logs", label: "Audit Logs" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, claims } = useAuthz();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-black text-white grid place-items-center font-bold">ET</div>
            <div>
              <div className="font-semibold leading-4">EthioTaxi Admin</div>
              <div className="text-xs text-gray-500 leading-4">
                {user?.email || "—"} {claims?.admin ? "(ADMIN)" : ""}
              </div>
            </div>
          </div>
          <button
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            onClick={async () => {
              await signOut(auth);
              window.location.href = "/sign-in";
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-4 px-4 py-5">
        <aside className="col-span-12 md:col-span-3">
          <nav className="rounded-xl border bg-white p-2">
            {nav.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    active ? "bg-black text-white" : "hover:bg-gray-50"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="col-span-12 md:col-span-9">{children}</main>
      </div>
    </div>
  );
}
