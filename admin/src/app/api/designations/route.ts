import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAdminFromRequest, AdminFieldValue } from "@/lib/firebaseAdmin";
import { writeAudit } from "@/lib/audit";

function asStr(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const { searchParams } = new URL(req.url);
  const status = asStr(searchParams.get("status")) || "OPEN";

  let q = adminDb.collection("designations").orderBy("createdAt", "desc").limit(200);
  if (status) q = q.where("status", "==", status);

  const snap = await q.get();
  const rows = snap.docs.map((d) => ({ designationId: d.id, ...d.data() }));
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const body = await req.json().catch(() => ({}));
  const action = asStr(body.action);

  if (action === "close") {
    const designationId = asStr(body.designationId);
    const note = asStr(body.note) || null;
    if (!designationId) return NextResponse.json({ error: "designationId required" }, { status: 400 });

    await adminDb.doc(`designations/${designationId}`).set(
      {
        status: "CLOSED",
        closeNote: note,
        closedAt: AdminFieldValue.serverTimestamp(),
        closedByAuthorityUid: v.uid, // admin can close for demo
        updatedAt: AdminFieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await writeAudit({
      action: "authority:closeDesignation",
      actorUid: v.uid,
      actorEmail: v.email || null,
      designationId,
      targetPath: `designations/${designationId}`,
      meta: { note, via: "admin-portal" },
    });

    return NextResponse.json({ ok: true });
  }

  // create designation
  const plate = asStr(body.plate).toUpperCase();
  const targetStationId = asStr(body.targetStationId).toUpperCase();
  const note = asStr(body.note) || null;

  if (!plate) return NextResponse.json({ error: "plate required" }, { status: 400 });
  if (!targetStationId) return NextResponse.json({ error: "targetStationId required" }, { status: 400 });

  const id = crypto.randomUUID();
  await adminDb.doc(`designations/${id}`).set({
    designationId: id,
    plate,
    targetStationId,
    note,
    status: "OPEN",
    createdAt: AdminFieldValue.serverTimestamp(),
    createdByAuthorityUid: v.uid, // admin can create for demo
    updatedAt: AdminFieldValue.serverTimestamp(),
  });

  await writeAudit({
    action: "authority:createDesignation",
    actorUid: v.uid,
    actorEmail: v.email || null,
    designationId: id,
    plate,
    targetPath: `designations/${id}`,
    meta: { targetStationId, note, via: "admin-portal" },
  });

  return NextResponse.json({ ok: true, designationId: id });
}
