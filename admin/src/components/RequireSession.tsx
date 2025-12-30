"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function RequireSession() {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const res = await fetch("/api/session", { method: "GET", cache: "no-store" });
      if (cancelled) return;

      if (!res.ok) {
        router.replace(`/sign-in?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }
      setOk(true);
    }

    check().catch(() => {
      router.replace(`/sign-in?next=${encodeURIComponent(pathname || "/dashboard")}`);
    });

    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (ok) return null;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="rounded-2xl border bg-white p-5 text-sm text-gray-700">
        Checking session…
      </div>
    </div>
  );
}