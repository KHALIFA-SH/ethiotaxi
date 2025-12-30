"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authedFetch, safeJson } from "@/lib/requireAdmin";
import { useRequireSession } from "@/lib/useSession";
import { ConfirmModal } from "@/components/ConfirmModal";

type VehicleRow = any;

export default function VehiclesPage() {
  const { loading } = useRequireSession();

  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [filterPlate, setFilterPlate] = useState("");
  const [filterTapela, setFilterTapela] = useState("");

  const [mode, setMode] = useState<"create" | "upsert">("create");

  const [plate, setPlate] = useState("");
  const [seatCapacity, setSeatCapacity] = useState<number>(12);
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | "REVOKED">("ACTIVE");
  const [vin, setVin] = useState("");
  const [tapela, setTapela] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; plate?: string }>({ open: false });

  async function load() {
    try {
      setErr(null);
      const q = new URLSearchParams();
      if (filterPlate.trim()) q.set("plate", filterPlate.trim());
      if (filterTapela.trim()) q.set("tapela", filterTapela.trim());

      const r = await authedFetch(`/api/vehicles?${q.toString()}`);
      const j = await safeJson(r);
      if (!r.ok) throw new Error(j?.error || `Failed to load vehicles (${r.status})`);
      setRows(j.rows || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load vehicles");
    }
  }

  useEffect(() => {
    if (!loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function save() {
    try {
      setErr(null);
      const r = await authedFetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          plate,
          seatCapacity,
          status,
          vin,
          tapela,
          ownerName,
          ownerPhone,
        }),
      });
      const j = await safeJson(r);

      if (!r.ok) {
        if (r.status === 409 && j?.error === "DUPLICATE_PLATE") {
          throw new Error("Duplicate plate. Switch Mode to “Update” if you want to edit the existing vehicle.");
        }
        throw new Error(j?.error || `Failed to save vehicle (${r.status})`);
      }

      setPlate("");
      setVin("");
      setTapela("");
      setOwnerName("");
      setOwnerPhone("");
      setMode("create");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to save vehicle");
    }
  }

  async function deleteVehicle(p: string) {
    try {
      setErr(null);
      const r = await authedFetch(`/api/vehicles?plate=${encodeURIComponent(p)}`, { method: "DELETE" });
      const j = await safeJson(r);
      if (!r.ok) throw new Error(j?.error || `Failed to delete vehicle (${r.status})`);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete vehicle");
    }
  }

  const tableRows = useMemo(() => rows, [rows]);

  return (
    <div style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <ConfirmModal
        open={confirmDelete.open}
        title="Remove vehicle?"
        message={`This will remove the vehicle record for plate: ${confirmDelete.plate}.`}
        confirmText="Remove"
        destructive
        onClose={() => setConfirmDelete({ open: false })}
        onConfirm={async () => {
          const p = confirmDelete.plate!;
          setConfirmDelete({ open: false });
          await deleteVehicle(p);
        }}
      />

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900 }}>Vehicles (Plate-based)</h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>Plate is the unique ID. Tapela is optional metadata.</p>
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

      <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Create / Update Vehicle</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: "#475467", fontWeight: 700 }}>Mode:</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            style={{ border: "1px solid #d0d5dd", borderRadius: 10, padding: "8px 10px" }}
          >
            <option value="create">Create (error if plate exists)</option>
            <option value="upsert">Update (create or overwrite)</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <Input label="Plate (required)" value={plate} onChange={setPlate} placeholder="A-12345" />
          <Input
            label="Seat capacity (required)"
            value={String(seatCapacity)}
            onChange={(v) => setSeatCapacity(Number(v))}
            placeholder="12"
          />
          <Select
            label="Status"
            value={status}
            onChange={(v) => setStatus(v as any)}
            options={["ACTIVE", "SUSPENDED", "REVOKED"]}
          />
          <Input label="VIN (optional)" value={vin} onChange={setVin} placeholder="1HG..." />
          <Input label="Tapela (optional)" value={tapela} onChange={setTapela} placeholder="tapela (not unique)" />
          <Input label="Owner name (optional)" value={ownerName} onChange={setOwnerName} />
          <Input label="Owner phone (optional)" value={ownerPhone} onChange={setOwnerPhone} placeholder="09..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={save} style={btnPrimary()}>
            Save vehicle
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, border: "1px solid var(--border)", borderRadius: 14, padding: 14, background: "#fff" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <Input label="Filter plate" value={filterPlate} onChange={setFilterPlate} placeholder="A-" />
          <Input label="Filter tapela" value={filterTapela} onChange={setFilterTapela} placeholder="tapela" />
          <button onClick={load} style={btnSecondary()}>
            Apply
          </button>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={th()}>Plate</th>
                <th style={th()}>Seat</th>
                <th style={th()}>Status</th>
                <th style={th()}>Tapela</th>
                <th style={th()}>VIN</th>
                <th style={th()}>Owner</th>
                <th style={th()}>Drivers</th>
                <th style={th()}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r: any) => (
                <VehicleRowItem
                  key={String(r.plate)}
                  row={r}
                  onEdit={() => {
                    setMode("upsert");
                    setPlate(String(r.plate || ""));
                    setSeatCapacity(Number(r.seatCapacity || 12));
                    setStatus((r.status || "ACTIVE") as any);
                    setVin(String(r.vin || ""));
                    setTapela(String(r.tapela || ""));
                    setOwnerName(String(r.ownerName || ""));
                    setOwnerPhone(String(r.ownerPhone || ""));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onDelete={() => setConfirmDelete({ open: true, plate: String(r.plate) })}
                />
              ))}
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 12, color: "var(--muted)" }}>
                    No vehicles.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function VehicleRowItem({
  row,
  onEdit,
  onDelete,
}: {
  row: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [linkUid, setLinkUid] = useState("");
  const [linkErr, setLinkErr] = useState<string | null>(null);

  async function loadDrivers() {
    setLoading(true);
    try {
      const r = await authedFetch(`/api/vehicles/${encodeURIComponent(String(row.plate))}/drivers`);
      const j = await safeJson(r);
      if (!r.ok) throw new Error(j?.error || "Failed to load drivers");
      setDrivers(j.rows || []);
    } finally {
      setLoading(false);
    }
  }

  async function linkDriver() {
    setLinkErr(null);
    try {
      const uid = linkUid.trim();
      if (!uid) throw new Error("Enter driver UID");
      const r = await authedFetch(`/api/vehicles/${encodeURIComponent(String(row.plate))}/link-driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const j = await safeJson(r);
      if (!r.ok) throw new Error(j?.error || "Failed to link driver");
      setLinkUid("");
      await loadDrivers();
    } catch (e: any) {
      setLinkErr(e?.message || "Failed to link driver");
    }
  }

  return (
    <>
      <tr style={{ borderBottom: "1px solid #f2f4f7" }}>
        <td style={td()}><b>{row.plate}</b></td>
        <td style={td()}>{row.seatCapacity}</td>
        <td style={td()}>{row.status}</td>
        <td style={td()}>{row.tapela || "—"}</td>
        <td style={td()}>{row.vin || "—"}</td>
        <td style={td()}>{row.ownerName ? `${row.ownerName} (${row.ownerPhone || "—"})` : "—"}</td>
        <td style={td()}>
          <button
            style={btnSmall()}
            onClick={async () => {
              const next = !open;
              setOpen(next);
              if (next) await loadDrivers();
            }}
          >
            {open ? "Hide" : "Show"}
          </button>
        </td>
        <td style={td()}>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnSmall()} onClick={onEdit}>Edit</button>
            <button style={btnSmallDanger()} onClick={onDelete}>Remove</button>
          </div>
        </td>
      </tr>

      {open ? (
        <tr style={{ borderBottom: "1px solid #f2f4f7" }}>
          <td colSpan={8} style={{ padding: 12, background: "#fcfcfd" }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Linked Drivers</div>

            <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
              <Input label="Link driver UID" value={linkUid} onChange={setLinkUid} placeholder="Firebase UID" />
              <button style={btnPrimary()} onClick={linkDriver}>Link</button>
            </div>

            {linkErr ? (
              <div style={{ marginTop: 10, padding: 10, border: "1px solid #fda29b", background: "#fffbfa", borderRadius: 12, color: "#b42318" }}>
                {linkErr}
              </div>
            ) : null}

            {loading ? <div style={{ color: "var(--muted)", marginTop: 10 }}>Loading…</div> : null}
            {!loading && drivers.length === 0 ? <div style={{ color: "var(--muted)", marginTop: 10 }}>No drivers linked.</div> : null}

            {!loading && drivers.length > 0 ? (
              <ul style={{ margin: "10px 0 0 0", paddingLeft: 18 }}>
                {drivers.map((d) => (
                  <li key={d.uid}>
                    <code>{d.uid}</code>
                  </li>
                ))}
              </ul>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
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
    <label style={{ display: "block", minWidth: 220 }}>
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

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#475467", marginBottom: 6 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", border: "1px solid #d0d5dd", borderRadius: 10, padding: "10px 12px" }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function th(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 12, color: "#475467", fontWeight: 800 };
}
function td(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 13, color: "#101828" };
}
function btnPrimary(): React.CSSProperties {
  return { background: "var(--brand)", color: "white", border: 0, padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 800 };
}
function btnSecondary(): React.CSSProperties {
  return { background: "white", color: "#111827", border: "1px solid #d0d5dd", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 800 };
}
function btnSmall(): React.CSSProperties {
  return { background: "white", color: "#111827", border: "1px solid #d0d5dd", padding: "6px 10px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 800 };
}
function btnSmallDanger(): React.CSSProperties {
  return { background: "white", color: "#b42318", border: "1px solid #fda29b", padding: "6px 10px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 800 };
}