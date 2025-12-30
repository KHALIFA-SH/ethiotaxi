"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedFetch, safeJson } from "@/lib/requireAdmin";

type Station = {
  stationId: string;
  nameAm?: string;
  nameEn?: string;
  lat?: number;
  lng?: number;
};

export default function StationsPage() {
  const [items, setItems] = useState<Station[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [stationId, setStationId] = useState("");
  const [nameAm, setNameAm] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [lat, setLat] = useState("0");
  const [lng, setLng] = useState("0");

  async function load() {
    setErr(null);
    const r = await authedFetch("/api/stations");
    const j = await safeJson(r);
    if (!r.ok) {
      setErr(j?.error || "Failed to load stations");
      setItems([]);
      return;
    }
    setItems((j?.rows || []) as Station[]);
  }

  async function upsert() {
    setErr(null);
    const r = await authedFetch("/api/stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stationId: stationId.trim(),
        nameAm: nameAm.trim(),
        nameEn: nameEn.trim(),
        lat: Number(lat),
        lng: Number(lng),
      }),
    });
    const j = await safeJson(r);
    if (!r.ok) {
      setErr(j?.error || "Failed to save station");
      return;
    }
    setStationId("");
    setNameAm("");
    setNameEn("");
    setLat("0");
    setLng("0");
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Stations</h1>
          <p style={{ color: "#667085", marginTop: 6 }}>Create/update stations and coordinates.</p>
        </div>
        <Link href="/dashboard" style={{ color: "#475467", textDecoration: "none" }}>
          ← Dashboard
        </Link>
      </div>

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

      <div style={{ marginTop: 14, border: "1px solid #eaecf0", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Create / Update Station</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <Input label="StationId (required)" value={stationId} onChange={setStationId} placeholder="MEGENAGNA" />
          <Input label="Name (Amharic)" value={nameAm} onChange={setNameAm} placeholder="መገናኛ" />
          <Input label="Name (English)" value={nameEn} onChange={setNameEn} placeholder="Megenagna" />
          <Input label="Lat" value={lat} onChange={setLat} placeholder="0" />
          <Input label="Lng" value={lng} onChange={setLng} placeholder="0" />
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={upsert} style={btnPrimary()}>
            Save station
          </button>
          <button onClick={load} style={{ ...btnSecondary(), marginLeft: 10 }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid #eaecf0", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>All stations</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eaecf0" }}>
                <th style={th()}>StationId</th>
                <th style={th()}>NameAm</th>
                <th style={th()}>NameEn</th>
                <th style={th()}>Lat</th>
                <th style={th()}>Lng</th>
              </tr>
            </thead>
            <tbody>
              {(items || []).map((s) => (
                <tr key={s.stationId} style={{ borderBottom: "1px solid #f2f4f7" }}>
                  <td style={td()}>
                    <b>{s.stationId}</b>
                  </td>
                  <td style={td()}>{s.nameAm || "—"}</td>
                  <td style={td()}>{s.nameEn || "—"}</td>
                  <td style={td()}>{String(s.lat ?? "—")}</td>
                  <td style={td()}>{String(s.lng ?? "—")}</td>
                </tr>
              ))}
              {(!items || items.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: "#667085" }}>
                    No stations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, color: "#667085", fontSize: 13 }}>
          Tip: you can still seed from backend, but now you can create stations directly here.
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#475467", marginBottom: 6 }}>{label}</div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", border: "1px solid #d0d5dd", borderRadius: 10, padding: "10px 12px" }}
      />
    </label>
  );
}

function th(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 12, color: "#475467", fontWeight: 700 };
}
function td(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 13, color: "#101828" };
}
function btnPrimary(): React.CSSProperties {
  return { background: "#111827", color: "white", border: 0, padding: "10px 14px", borderRadius: 12, cursor: "pointer" };
}
function btnSecondary(): React.CSSProperties {
  return { background: "white", color: "#111827", border: "1px solid #d0d5dd", padding: "10px 14px", borderRadius: 12, cursor: "pointer" };
}