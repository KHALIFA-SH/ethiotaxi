import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";
import { writeAudit } from "@/lib/audit";

export async function DELETE(req: NextRequest, ctx: { params: { plate: string } }) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const db = getAdminDb();
  const plate = decodeURIComponent(String(ctx?.params?.plate || "")).trim();
  if (!plate) return NextResponse.json({ error: "plate required" }, { status: 400 });

  try {
    const ref = db.doc(`vehicles/${plate}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "VEHICLE_NOT_FOUND" }, { status: 404 });

    // delete drivers subcollection docs (non-cascading in Firestore)
    const driversSnap = await db.collection(`vehicles/${plate}/drivers`).get();
    const batch = db.batch();
    driversSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);

    await batch.commit();

    await writeAudit("admin:deleteVehicle", {
      actorUid: v.uid,
      actorEmail: v.email,
      plate,
      target: `vehicles/${plate}`,
      driversDeleted: driversSnap.size,
    });

    return NextResponse.json({ ok: true, plate });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete vehicle" }, { status: 500 });
  }
}