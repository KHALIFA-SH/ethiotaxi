"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authedFetch, safeJson } from "@/lib/requireAdmin";
import { ConfirmModal } from "@/components/ConfirmModal";

type VehicleRow = {
  plate: string;
  seatCapacity: number;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  vin?: string;
  tapela?: string;
  ownerName?: string;
  ownerPhone?: string;
  updatedAt?: any;
};

function norm(s: any) {
  return String(s || "").trim().toUpperCase();
}

export default function VehiclesPage() {
  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [filterPlate, setFilterPlate] = useState("");
  const [filterTapela, setFilterTapela] = useState("");

  const [mode, setMode] = useState<"create" | "upsert">("create");

  // Create/Upsert form
  const [plate, setPlate] = useState("");
  const [seatCapacity, setSeatCapacity] = useState<number>(12);
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | "REVOKED">("ACTIVE");
  const [vin, setVin] = useState("");
  const [tapela, setTapela] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  // Modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<VehicleRow | null>(null);

  async function load() {
    setBusy(true);
    try {
      setErr(null);
      const q = new URLSearchParams();
      if (filterPlate.trim()) q.set("plate", filterPlate.trim());
      if (filterTapela.trim()) q.set("tapela", filterTapela.trim());

      const url = q.toString() ? `/api/vehicles?${q.toString()}` : "/api/vehicles";
      const r = await authedFetch(url);
      const j = await safeJson(r);
      if (!r.ok) throw new Error(j?.error || "Failed to load vehicles");
      setRows(j?.rows || []);
    } catch (e: any) {
      setRows([]);
      setErr(e?.message || "Failed to load vehicles");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upsert() {
    setBusy(true);
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
        // show friendly duplicate error
        if (j?.error === "PLATE_ALREADY_EXISTS")
          throw new Error("Plate already exists. Switch mode to Upsert, or use a different plate.");
        throw new Error(j?.error || "Failed to save vehicle");
      }

      setPlate("");
      setVin("");
      setTapela("");
      setOwnerName("");
      setOwnerPhone("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to save vehicle");
    } finally {
      setBusy(false);
    }
  }

  const tableRows = useMemo(() => rows, [rows]);

  const showNoFound =
    !busy &&
    tableRows.length === 0 &&
    (filterPlate.trim().length > 0 || filterTapela.trim().length > 0);

  return (
    <div style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Vehicles (Plate-based)</h1>
          <p style={{ color: "var(--muted)", marginTop: 6 }}>
            Plate is the unique ID. Tapela is optional metadata.
          </p>
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

      {/* Create / Update */}
      <div style={card()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Create / Update Vehicle</div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#475467", fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>Mode:</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "8px 10px",
                background: "white",
              }}
            >
              <option value="create">Create (error if plate exists)</option>
              <option value="upsert">Upsert (create or update)</option>
            </select>
          </label>
        </div>

        <div style={grid()}>
          <Input label="Plate (required)" value={plate} onChange={setPlate} placeholder="A-12345" />
          <Input
            label="Seat capacity (required)"
            value={String(seatCapacity)}
            onChange={(v) => setSeatCapacity(Number(v))}
            placeholder="12"
          />
          <Select label="Status" value={status} onChange={(v) => setStatus(v as any)} options={["ACTIVE", "SUSPENDED", "REVOKED"]} />

          <Input label="VIN (optional)" value={vin} onChange={setVin} placeholder="1HG..." />
          <Input label="Tapela (optional)" value={tapela} onChange={setTapela} placeholder="tapela (not unique)" />
          <Input label="Owner name (optional)" value={ownerName} onChange={setOwnerName} />
          <Input label="Owner phone (optional)" value={ownerPhone} onChange={setOwnerPhone} placeholder="09..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={upsert} style={btnPrimary()} disabled={busy}>
            {busy ? "Saving…" : "Save vehicle"}
          </button>
        </div>
      </div>

      {/* Filters + table */}
      <div style={card()}>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 220, flex: "1 1 220px" }}>
            <Input label="Filter plate" value={filterPlate} onChange={setFilterPlate} placeholder="A-" />
          </div>
          <div style={{ minWidth: 220, flex: "1 1 220px" }}>
            <Input label="Filter tapela" value={filterTapela} onChange={setFilterTapela} placeholder="tapela" />
          </div>

          <button onClick={load} style={btnSecondary()} disabled={busy}>
            {busy ? "Loading…" : "Apply"}
          </button>
          <button
            onClick={() => {
              setFilterPlate("");
              setFilterTapela("");
              // load after state update
              setTimeout(() => load(), 0);
            }}
            style={btnTertiary()}
            disabled={busy}
          >
            Clear
          </button>
        </div>

        {showNoFound ? (
          <div style={{ marginTop: 10, color: "var(--muted)" }}>
            No vehicles found for filters:{" "}
            <b>
              {filterPlate ? `plate starts with "${filterPlate.trim()}"` : ""}
              {filterPlate && filterTapela ? ", " : ""}
              {filterTapela ? `tapela contains "${filterTapela.trim()}"` : ""}
            </b>
          </div>
        ) : null}

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
                <th style={th()}>Updated</th>
                <th style={th()}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr
                  key={String(r.plate)}
                  style={{ borderBottom: "1px solid #f2f4f7", cursor: "pointer" }}
                  onClick={() => {
                    setSelected(r);
                    setOpen(true);
                  }}
                  title="Click to view / edit"
                >
                  <td style={td()}>
                    <b>{r.plate}</b>
                  </td>
                  <td style={td()}>{r.seatCapacity}</td>
                  <td style={td()}>{r.status}</td>
                  <td style={td()}>{r.tapela || "—"}</td>
                  <td style={td()}>{r.vin || "—"}</td>
                  <td style={td()}>{r.ownerName ? `${r.ownerName} (${r.ownerPhone || "—"})` : "—"}</td>
                  <td style={td()}>{toDate(r.updatedAt) || "—"}</td>
                  <td style={td()}>
                    <button
                      style={btnSmall()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(r);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {!busy && tableRows.length === 0 && !showNoFound ? (
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

      {/* Modal */}
      <VehicleModal
        open={open}
        row={selected}
        onClose={() => {
          setOpen(false);
          setSelected(null);
        }}
        onChanged={async () => {
          await load();
        }}
      />
    </div>
  );
}

function VehicleModal({
  open,
  row,
  onClose,
  onChanged,
}: {
  open: boolean;
  row: VehicleRow | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [plate, setPlate] = useState("");
  const [seatCapacity, setSeatCapacity] = useState<number>(12);
  const [status, setStatus] = useState<"ACTIVE" | "SUSPENDED" | "REVOKED">("ACTIVE");
  const [vin, setVin] = useState("");
  const [tapela, setTapela] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    setErr(null);
    setPlate(row.plate || "");
    setSeatCapacity(Number(row.seatCapacity || 12));
    setStatus(row.status || "ACTIVE");
    setVin(row.vin || "");
    setTapela(row.tapela || "");
    setOwnerName(row.ownerName || "");
    setOwnerPhone(row.ownerPhone || "");
  }, [open, row]);

  if (!open || !row) return null;

  async function save() {
    setBusy(true);
    try {
      setErr(null);

      const oldPlate = row.plate;
      const newPlate = norm(plate);

      if (!newPlate) throw new Error("Plate is required");
      if (!Number.isFinite(seatCapacity) || seatCapacity <= 0) throw new Error("Seat capacity is required");

      if (newPlate !== norm(oldPlate)) {
        // change plate (rename)
        const r = await authedFetch(`/api/vehicles/${encodeURIComponent(oldPlate)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newPlate,
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
          if (j?.error === "NEW_PLATE_ALREADY_EXISTS") throw new Error("New plate already exists.");
          throw new Error(j?.error || "Failed to change plate");
        }
      } else {
        // normal update
        const r = await authedFetch(`/api/vehicles/${encodeURIComponent(oldPlate)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seatCapacity,
            status,
            vin,
            tapela,
            ownerName,
            ownerPhone,
          }),
        });
        const j = await safeJson(r);
        if (!r.ok) throw new Error(j?.error || "Failed to update vehicle");
      }

      await onChanged();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      setErr(null);
      const r = await authedFetch(`/api/vehicles/${encodeURIComponent(row.plate)}`, { method: "DELETE" });
      const j = await safeJson(r);
      if (!r.ok) throw new Error(j?.error || "Failed to delete vehicle");
      await onChanged();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={modal.backdrop}>
      <ConfirmModal
        open={confirmDelete}
        title="Remove vehicle?"
        message={`This will permanently remove vehicle ${row.plate}.`}
        confirmText="Remove"
        destructive
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await doDelete();
        }}
      />

      <div style={modal.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Vehicle details</div>
            <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>
              Edit fields. Changing plate performs a rename (copy → delete old).
            </div>
          </div>
          <button onClick={onClose} style={btnIcon()} aria-label="Close">
            ✕
          </button>
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

        <div style={{ marginTop: 12, ...grid() }}>
          <Input label="Plate (required)" value={plate} onChange={setPlate} placeholder="A-12345" />
          <Input
            label="Seat capacity (required)"
            value={String(seatCapacity)}
            onChange={(v) => setSeatCapacity(Number(v))}
            placeholder="12"
          />
          <Select label="Status" value={status} onChange={(v) => setStatus(v as any)} options={["ACTIVE", "SUSPENDED", "REVOKED"]} />
          <Input label="VIN (optional)" value={vin} onChange={setVin} placeholder="1HG..." />
          <Input label="Tapela (optional)" value={tapela} onChange={setTapela} placeholder="tapela (not unique)" />
          <Input label="Owner name (optional)" value={ownerName} onChange={setOwnerName} />
          <Input label="Owner phone (optional)" value={ownerPhone} onChange={setOwnerPhone} placeholder="09..." />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button onClick={() => setConfirmDelete(true)} style={btnDanger()} disabled={busy}>
            Remove
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={btnSecondary()} disabled={busy}>
              Cancel
            </button>
            <button onClick={save} style={btnPrimary()} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function toDate(v: any) {
  if (!v) return "";
  const sec = v?._seconds ?? v?.seconds;
  if (typeof sec === "number") return new Date(sec * 1000).toLocaleString();
  if (typeof v === "string") return v;
  return "";
}

/**
 * ✅ IMPORTANT: The overlap fix is here:
 * - boxSizing: "border-box"
 * - maxWidth: "100%"
 * This prevents width:100% + padding from overflowing the grid cell.
 */
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
    <label style={{ display: "block", minWidth: 0, maxWidth: "100%" }}>
      <div style={{ fontSize: 12, color: "#475467", marginBottom: 6, fontWeight: 700 }}>{label}</div>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "10px 12px",
          background: "white",
        }}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label style={{ display: "block", minWidth: 0, maxWidth: "100%" }}>
      <div style={{ fontSize: 12, color: "#475467", marginBottom: 6, fontWeight: 700 }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "10px 12px",
          background: "white",
        }}
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

function grid(): React.CSSProperties {
  return {
    display: "grid",
    // Key: responsive and prevents overlap
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 10,
    alignItems: "end",
  };
}

function card(): React.CSSProperties {
  return {
    marginTop: 14,
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: 14,
    background: "#fff",
  };
}

function th(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 12, color: "#475467", fontWeight: 700 };
}
function td(): React.CSSProperties {
  return { padding: "10px 10px", fontSize: 13, color: "#101828" };
}

function btnPrimary(): React.CSSProperties {
  return {
    background: "var(--brand)",
    color: "white",
    border: 0,
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 800,
  };
}
function btnSecondary(): React.CSSProperties {
  return {
    background: "white",
    color: "#111827",
    border: "1px solid #d0d5dd",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 800,
  };
}
function btnTertiary(): React.CSSProperties {
  return {
    background: "#f9fafb",
    color: "#111827",
    border: "1px solid #e5e7eb",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 800,
  };
}
function btnSmall(): React.CSSProperties {
  return {
    background: "white",
    color: "#111827",
    border: "1px solid #d0d5dd",
    padding: "6px 10px",
    borderRadius: 10,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  };
}
function btnDanger(): React.CSSProperties {
  return {
    background: "#ef4444",
    color: "white",
    border: 0,
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 900,
  };
}
function btnIcon(): React.CSSProperties {
  return {
    background: "white",
    border: "1px solid var(--border)",
    borderRadius: 12,
    width: 36,
    height: 36,
    cursor: "pointer",
    fontWeight: 900,
  };
}

const modal: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(16,24,40,0.35)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 50,
  },
  card: {
    width: "min(860px, 100%)",
    background: "white",
    borderRadius: 18,
    padding: 16,
    border: "1px solid var(--border)",
    boxShadow: "0 20px 60px rgba(16,24,40,0.2)",
  },
};