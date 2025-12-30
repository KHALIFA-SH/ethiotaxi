import { NextResponse } from "next/server";
import { getAdminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

export async function GET(req: Request, ctx: { params: { plate: string } }) {
  try {
    await verifyAdminFromRequest(req);
    const db = getAdminDb();
    const plate = decodeURIComponent(ctx.params.plate);

    const snap = await db.collection("vehicles").doc(plate).collection("drivers").limit(200).get();
    const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "FAILED" }, { status: 401 });
  }
}