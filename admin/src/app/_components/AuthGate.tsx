"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthz } from "@/lib/useAuthz";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, allowed } = useAuthz();

  useEffect(() => {
    if (!loading && !allowed) router.replace("/sign-in");
  }, [loading, allowed, router]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="animate-pulse text-sm text-gray-500">Loading auth…</div>
      </div>
    );
  }
  if (!allowed) return null;
  return <>{children}</>;
}
