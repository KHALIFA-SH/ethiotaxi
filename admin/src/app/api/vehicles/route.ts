import { NextResponse } from "next/server";
import { AdminFieldValue, getAdminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

function clean(s: any) {
  return typeof s === "string" ? s.trim() : s;
}

export async function GET(req: Request) {
  try {
    await verifyAdminFromRequest(req);
    const db = getAdminDb();
    const url = new URL(req.url);

    const plate = clean(url.searchParams.get("plate"));
    const tapela = clean(url.searchParams.get("tapela"));

    let q: FirebaseFirestore.Query = db.collection("vehicles");
    if (plate) q = q.where("plate", "==", plate);
    if (tapela) q = q.where("tapela", "==", tapela);

    const snap = await q.limit(200).get();
    const rows = snap.docs.map((d) => ({ ...d.data(), plate: d.id }));

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "FAILED" }, { status: 401 });
  }
}

/**
 * POST body:
 * { mode?: "create"|"upsert", plate, seatCapacity, status, vin?, tapela?, ownerName?, ownerPhone? }
 */
export async function POST(req: Request) {
  try {
    await verifyAdminFromRequest(req);
    const db = getAdminDb();
    const body = await req.json().catch(() => ({}));

    const mode = body?.mode === "create" ? "create" : "upsert";
    const plate = clean(body?.plate);
    const seatCapacity = Number(body?.seatCapacity);
    const status = clean(body?.status);

    if (!plate) return NextResponse.json({ error: "plate required" }, { status: 400 });
    if (!Number.isFinite(seatCapacity) || seatCapacity <= 0)
      return NextResponse.json({ error: "seatCapacity must be > 0" }, { status: 400 });
    if (!["ACTIVE", "SUSPENDED", "REVOKED"].includes(status))
      return NextResponse.json({ error: "invalid status" }, { status: 400 });

    const ref = db.collection("vehicles").doc(plate);
    const existing = await ref.get();

    if (mode === "create" && existing.exists) {
      return NextResponse.json({ error: "DUPLICATE_PLATE" }, { status: 409 });
    }

    await ref.set(
      {
        plate,
        seatCapacity,
        status,
        vin: clean(body?.vin) || null,
        tapela: clean(body?.tapela) || null,
        ownerName: clean(body?.ownerName) || null,
        ownerPhone: clean(body?.ownerPhone) || null,
        updatedAt: AdminFieldValue.serverTimestamp(),
        createdAt: existing.exists ? (existing.data() as any)?.createdAt || AdminFieldValue.serverTimestamp() : AdminFieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "FAILED" }, { status: 401 });
  }
}

/**
 * DELETE /api/vehicles?plate=...
 */
export async function DELETE(req: Request) {
  try {
    await verifyAdminFromRequest(req);
    const db = getAdminDb();
    const url = new URL(req.url);
    const plate = clean(url.searchParams.get("plate"));
    if (!plate) return NextResponse.json({ error: "plate required" }, { status: 400 });

    // Delete main doc. (Subcollections remain unless explicitly deleted; acceptable for admin v1)
    await db.collection("vehicles").doc(plate).delete();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "FAILED" }, { status: 401 });
  }
}