import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const db = getAdminDb();
  const { searchParams } = new URL(req.url);

  const stationId = (searchParams.get("stationId") || "").trim();
  const plate = (searchParams.get("plate") || "").trim();
  const actorUid = (searchParams.get("actorUid") || "").trim();

  try {
    let q: FirebaseFirestore.Query = db.collection("auditLogs").orderBy("ts", "desc").limit(200);
    // keep filters simple (exact match only)
    if (stationId) q = db.collection("auditLogs").where("stationId", "==", stationId).orderBy("ts", "desc").limit(200);
    if (!stationId && plate) q = db.collection("auditLogs").where("plate", "==", plate).orderBy("ts", "desc").limit(200);
    if (!stationId && !plate && actorUid) q = db.collection("auditLogs").where("actorUid", "==", actorUid).orderBy("ts", "desc").limit(200);

    const snap = await q.get();
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load audit logs" }, { status: 500 });
  }
}