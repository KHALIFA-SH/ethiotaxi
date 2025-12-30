"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/requireAdmin";

type Config = {
  stationDispatchFeeAmount: number;
  cityTelebirrPhone: string;
  avgPassengersPerVan: number;
  contractExpiryWarnDays: number;
  driverClaimTTLMinutes: number;
  paymentClaimTTLMinutes: number;
  driverVerificationValidityDays: number;
  ratingRateLimitPerHourVerified: number;
  ratingRateLimitPerHourUnverified: number;
  ratingTokenUniqueRequired: boolean;
};

export default function ConfigPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      const r = await authedFetch("/api/config");
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to load config");
      setCfg(j.config);
    } catch (e: any) {
      setErr(e?.message || "Failed to load config");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      setErr(null);
      const r = await authedFetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to save config");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to save config");
    }
  }

  if (!cfg) {
    return (
      <div style={{ padding: 18 }}>
        <div>Loading…</div>
        {err ? <div style={{ color: "#b42318" }}>{err}</div> : null}
      </div>
    );
  }

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Config</h1>
          <p style={{ color: "#667085", marginTop: 6 }}>Editable config/app fields used by dispatch, claims, verification, and rating limits.</p>
        </div>
        <Link href="/dashboard" style={{ color: "#475467", textDecoration: "none" }}>
          ← Dashboard
        </Link>
      </div>

      {err ? (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #fda29b", background: "#fffbfa", borderRadius: 12, color: "#b42318" }}>
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 14, border: "1px solid #eaecf0", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <Num label="stationDispatchFeeAmount" value={cfg.stationDispatchFeeAmount} onChange={(v) => setCfg({ ...cfg, stationDispatchFeeAmount: v })} />
          <Text label="cityTelebirrPhone" value={cfg.cityTelebirrPhone} onChange={(v) => setCfg({ ...cfg, cityTelebirrPhone: v })} />
          <Num label="avgPassengersPerVan" value={cfg.avgPassengersPerVan} onChange={(v) => setCfg({ ...cfg, avgPassengersPerVan: v })} />

          <Num label="contractExpiryWarnDays" value={cfg.contractExpiryWarnDays} onChange={(v) => setCfg({ ...cfg, contractExpiryWarnDays: v })} />
          <Num label="driverClaimTTLMinutes" value={cfg.driverClaimTTLMinutes} onChange={(v) => setCfg({ ...cfg, driverClaimTTLMinutes: v })} />
          <Num label="paymentClaimTTLMinutes" value={cfg.paymentClaimTTLMinutes} onChange={(v) => setCfg({ ...cfg, paymentClaimTTLMinutes: v })} />

          <Num
            label="driverVerificationValidityDays"
            value={cfg.driverVerificationValidityDays}
            onChange={(v) => setCfg({ ...cfg, driverVerificationValidityDays: v })}
          />
          <Num
            label="ratingRateLimitPerHourVerified"
            value={cfg.ratingRateLimitPerHourVerified}
            onChange={(v) => setCfg({ ...cfg, ratingRateLimitPerHourVerified: v })}
          />
          <Num
            label="ratingRateLimitPerHourUnverified"
            value={cfg.ratingRateLimitPerHourUnverified}
            onChange={(v) => setCfg({ ...cfg, ratingRateLimitPerHourUnverified: v })}
          />

          <label style={{ display: "block" }}>
            <div style={{ fontSize: 12, color: "#475467", marginBottom: 6 }}>ratingTokenUniqueRequired</div>
            <select
              value={cfg.ratingTokenUniqueRequired ? "true" : "false"}
              onChange={(e) => setCfg({ ...cfg, ratingTokenUniqueRequired: e.target.value === "true" })}
              style={{ width: "100%", border: "1px solid #d0d5dd", borderRadius: 10, padding: "10px 12px" }}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={save} style={btnPrimary()}>
            Save config
          </button>
        </div>
      </div>
    </div>
  );
}

function Text({ label, value, onChange }: any) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#475467", marginBottom: 6 }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", border: "1px solid #d0d5dd", borderRadius: 10, padding: "10px 12px" }}
      />
    </label>
  );
}

function Num({ label, value, onChange }: any) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#475467", marginBottom: 6 }}>{label}</div>
      <input
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", border: "1px solid #d0d5dd", borderRadius: 10, padding: "10px 12px" }}
        type="number"
      />
    </label>
  );
}

function btnPrimary(): React.CSSProperties {
  return { background: "#111827", color: "white", border: 0, padding: "10px 14px", borderRadius: 12, cursor: "pointer" };
}
