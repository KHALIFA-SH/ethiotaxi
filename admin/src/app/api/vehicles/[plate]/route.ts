import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

function norm(s: string) {
  return String(s || "").trim().toUpperCase();
}

export async function GET(req: NextRequest, ctx: { params: { plate: string } }) {
  const gate = await verifyAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const db = getAdminDb();
  const plate = norm(ctx.params.plate || "");
  if (!plate) return NextResponse.json({ ok: false, error: "PLATE_REQUIRED" }, { status: 400 });

  const doc = await db.collection("vehicles").doc(plate).get();
  if (!doc.exists) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ ok: true, plate: doc.id, ...doc.data() }, { status: 200 });
}

export async function DELETE(req: NextRequest, ctx: { params: { plate: string } }) {
  const gate = await verifyAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const db = getAdminDb();
  const plate = norm(ctx.params.plate || "");
  if (!plate) return NextResponse.json({ ok: false, error: "PLATE_REQUIRED" }, { status: 400 });

  await db.collection("vehicles").doc(plate).delete();
  return NextResponse.json({ ok: true }, { status: 200 });
}

/**
 * PATCH supports:
 * - Update fields (same plate)
 * - Change plate (rename/move):
 *    { newPlate: "B-99999", ...optional fields to overwrite... }
 *
 * NOTE: This does NOT migrate subcollections. You said drivers are not implemented yet.
 */
export async function PATCH(req: NextRequest, ctx: { params: { plate: string } }) {
  const gate = await verifyAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const db = getAdminDb();
  const oldPlate = norm(ctx.params.plate || "");
  if (!oldPlate) return NextResponse.json({ ok: false, error: "PLATE_REQUIRED" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const newPlate = norm(body?.newPlate || "");
  const now = new Date();

  const oldRef = db.collection("vehicles").doc(oldPlate);

  if (!newPlate || newPlate === oldPlate) {
    // normal update
    await oldRef.set(
      {
        ...(body?.seatCapacity != null ? { seatCapacity: Number(body.seatCapacity) } : {}),
        ...(body?.status != null ? { status: body.status } : {}),
        ...(body?.vin != null ? { vin: String(body.vin || "").trim() } : {}),
        ...(body?.tapela != null ? { tapela: String(body.tapela || "").trim() } : {}),
        ...(body?.ownerName != null ? { ownerName: String(body.ownerName || "").trim() } : {}),
        ...(body?.ownerPhone != null ? { ownerPhone: String(body.ownerPhone || "").trim() } : {}),
        updatedAt: now,
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true, plate: oldPlate }, { status: 200 });
  }

  // change plate
  const newRef = db.collection("vehicles").doc(newPlate);

  await db.runTransaction(async (tx) => {
    const oldSnap = await tx.get(oldRef);
    if (!oldSnap.exists) throw new Error("NOT_FOUND");

    const newSnap = await tx.get(newRef);
    if (newSnap.exists) throw new Error("NEW_PLATE_ALREADY_EXISTS");

    const oldData = oldSnap.data() || {};

    // Copy base data, apply any edits from body if present
    const nextData = {
      ...oldData,
      ...(body?.seatCapacity != null ? { seatCapacity: Number(body.seatCapacity) } : {}),
      ...(body?.status != null ? { status: body.status } : {}),
      ...(body?.vin != null ? { vin: String(body.vin || "").trim() } : {}),
      ...(body?.tapela != null ? { tapela: String(body.tapela || "").trim() } : {}),
      ...(body?.ownerName != null ? { ownerName: String(body.ownerName || "").trim() } : {}),
      ...(body?.ownerPhone != null ? { ownerPhone: String(body.ownerPhone || "").trim() } : {}),
      updatedAt: now,
      // preserve createdAt if exists
      createdAt: oldData.createdAt ?? now,
    };

    tx.set(newRef, nextData, { merge: true });
    tx.delete(oldRef);
  });

  return NextResponse.json({ ok: true, plate: newPlate }, { status: 200 });
}