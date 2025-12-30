import { NextResponse } from "next/server";
import { AdminFieldValue, getAdminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

export async function POST(req: Request, ctx: { params: { plate: string } }) {
  try {
    const actor = await verifyAdminFromRequest(req);
    const db = getAdminDb();
    const plate = decodeURIComponent(ctx.params.plate);

    const body = await req.json().catch(() => ({}));
    const uid = String(body?.uid || "").trim();
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });

    const vehicleRef = db.collection("vehicles").doc(plate);
    const vehicle = await vehicleRef.get();
    if (!vehicle.exists) return NextResponse.json({ error: "VEHICLE_NOT_FOUND" }, { status: 404 });

    await vehicleRef.collection("drivers").doc(uid).set(
      {
        status: "ACTIVE",
        linkedAt: AdminFieldValue.serverTimestamp(),
        linkedByAdminUid: actor.uid,
        // keep fields compatible with your backend if present:
        lastVerifiedAt: null,
        verificationExpiresAt: null,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "FAILED" }, { status: 401 });
  }
}