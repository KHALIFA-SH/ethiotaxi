"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
      onClick={async () => {
        const ok = confirm("Sign out of Admin?");
        if (!ok) return;
        await fetch("/api/session", { method: "DELETE", credentials: "include" });
        router.replace("/sign-in");
      }}
    >
      Sign out
    </button>
  );
}