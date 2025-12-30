"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { safeJson } from "@/lib/requireAdmin";

function isEmu() {
  const v = process.env.NEXT_PUBLIC_USE_EMULATORS;
  return v === "1" || v === "true" || v === "TRUE";
}

export default function SignInPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const useEmulators = useMemo(() => isEmu(), []);
  const nextPath = useMemo(() => sp.get("next") || "/dashboard", [sp]);

  const [email, setEmail] = useState("admin@ethiotaxi.local");
  const [password, setPassword] = useState("Password123!");
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checkedExisting = useRef(false);

  // If already has a valid server session cookie, bounce to next once.
  useEffect(() => {
    if (checkedExisting.current) return;
    checkedExisting.current = true;

    (async () => {
      try {
        const r = await fetch("/api/session", { credentials: "include" });
        if (r.ok) router.replace(nextPath);
      } catch {
        // ignore
      }
    })();
  }, [router, nextPath]);

  async function createServerSession() {
    const u = auth.currentUser;
    if (!u) throw new Error("Not signed in (client)");

    const idToken = await u.getIdToken(true);

    const r = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      credentials: "include",
    });

    const j = await safeJson(r);
    if (!r.ok) throw new Error(j?.error || "Failed to create session");
  }

  async function doEmailLogin() {
    setErr(null);
    setHint(null);
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await createServerSession();
      router.replace(nextPath);
    } catch (e: any) {
      setErr(e?.message || "Email sign-in failed");
      try {
        await fbSignOut(auth);
      } catch {}
    } finally {
      setBusy(false);
    }
  }

  async function doEmailCreate() {
    setErr(null);
    setHint(null);
    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await createServerSession();
      router.replace(nextPath);
    } catch (e: any) {
      setErr(e?.message || "Create user failed");
      try {
        await fbSignOut(auth);
      } catch {}
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <div style={styles.logoMark} aria-hidden />
            <div>
              <div style={styles.title}>EthioTaxi Admin</div>
              <div style={styles.subTitle}>
                Sign in to manage stations, vehicles, employees, config, and audit logs.
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={styles.note}>
            Access requires <b>allowlist email</b> or <b>ADMIN claim</b>.
          </div>
        </div>

        {hint ? <div style={styles.hint}>{hint}</div> : null}
        {err ? <div style={styles.error}>{err}</div> : null}

        <div style={{ marginTop: 14, color: "#475467", fontSize: 13 }}>
          {useEmulators ? "Emulator mode: Email/Password" : "Email/Password"}
        </div>

        <label style={styles.label}>
          <div style={styles.labelText}>Email</div>
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label style={styles.label}>
          <div style={styles.labelText}>Password</div>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <div style={styles.grid2}>
          <button
            onClick={doEmailLogin}
            style={{ ...styles.primaryBtn, opacity: busy ? 0.75 : 1 }}
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          {useEmulators ? (
            <button
              onClick={doEmailCreate}
              style={{ ...styles.secondaryBtn, opacity: busy ? 0.75 : 1 }}
              disabled={busy}
            >
              {busy ? "Creating…" : "Create user"}
            </button>
          ) : (
            <button
              onClick={() => setHint("In production, create users in Firebase Console (Auth) or via admin tooling.")}
              style={styles.secondaryBtn}
              disabled={busy}
            >
              Help
            </button>
          )}
        </div>

        {useEmulators ? (
          <div style={styles.small}>
            Emulator tip: after creating the user, run <code>npm run set-admin:emu</code> inside{" "}
            <code>ethiotaxi/admin</code> to grant ADMIN claim.
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 60%)",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    border: "1px solid #eaecf0",
    borderRadius: 20,
    background: "#fff",
    padding: 18,
    boxShadow: "0 10px 30px rgba(16,24,40,0.08)",
  },
  header: { marginBottom: 10 },
  logoRow: { display: "flex", gap: 12, alignItems: "center" },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "linear-gradient(135deg, #10b981 0%, #22c55e 60%, #16a34a 100%)",
    boxShadow: "0 6px 18px rgba(16,185,129,0.25)",
  },
  title: { fontSize: 18, fontWeight: 900, color: "#101828", letterSpacing: 0.2 },
  subTitle: { marginTop: 4, fontSize: 13, color: "#667085" },
  note: {
    fontSize: 13,
    color: "#344054",
    padding: "10px 12px",
    border: "1px solid #eaecf0",
    borderRadius: 12,
    background: "#fcfcfd",
  },
  hint: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #b2ddff",
    background: "#eff8ff",
    color: "#175cd3",
    fontSize: 13,
  },
  error: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #fda29b",
    background: "#fffbfa",
    color: "#b42318",
    fontSize: 13,
  },
  primaryBtn: {
    marginTop: 14,
    width: "100%",
    borderRadius: 14,
    border: 0,
    padding: "12px 14px",
    fontWeight: 800,
    cursor: "pointer",
    color: "white",
    background: "#101828",
  },
  secondaryBtn: {
    marginTop: 14,
    width: "100%",
    borderRadius: 14,
    border: "1px solid #d0d5dd",
    padding: "12px 14px",
    fontWeight: 800,
    cursor: "pointer",
    color: "#101828",
    background: "white",
  },
  label: { display: "block", marginTop: 12 },
  labelText: { fontSize: 12, color: "#475467", marginBottom: 6, fontWeight: 700 },
  input: {
    width: "100%",
    borderRadius: 12,
    border: "1px solid #d0d5dd",
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  small: { marginTop: 12, fontSize: 12, color: "#667085" },
};