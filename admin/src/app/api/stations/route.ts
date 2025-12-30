import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, AdminFieldValue, verifyAdminFromRequest } from "@/lib/firebaseAdmin";
import { writeAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const db = getAdminDb();
  try {
    const snap = await db.collection("stations").orderBy("stationId", "asc").limit(500).get();
    const rows = snap.docs.map((d) => ({ stationId: d.id, ...d.data() }));
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load stations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const db = getAdminDb();
  const body = await req.json().catch(() => ({}));

  const stationId = String(body?.stationId || "").trim();
  const nameAm = String(body?.nameAm || "").trim();
  const nameEn = String(body?.nameEn || "").trim();
  const lat = Number(body?.lat ?? 0);
  const lng = Number(body?.lng ?? 0);

  if (!stationId) return NextResponse.json({ error: "stationId required" }, { status: 400 });
  if (!nameAm || !nameEn) return NextResponse.json({ error: "nameAm and nameEn required" }, { status: 400 });

  try {
    await db.doc(`stations/${stationId}`).set(
      {
        stationId,
        nameAm,
        nameEn,
        lat,
        lng,
        updatedAt: AdminFieldValue.serverTimestamp(),
        createdAt: AdminFieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await writeAudit("admin:upsertStation", {
      actorUid: v.uid,
      actorEmail: v.email,
      stationId,
      target: `stations/${stationId}`,
    });

    return NextResponse.json({ ok: true, stationId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save station" }, { status: 500 });
  }
}