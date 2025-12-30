import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, AdminFieldValue, verifyAdminFromRequest } from "@/lib/firebaseAdmin";
import { writeAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const db = getAdminDb();
  try {
    const snap = await db.collection("employeeCredentials").orderBy("updatedAt", "desc").limit(200).get();
    const rows = snap.docs.map((d) => ({ employeeId: d.id, ...d.data() }));
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load employees" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const db = getAdminDb();
  const body = await req.json().catch(() => ({}));

  const employeeId = String(body?.employeeId || "").trim();
  const staffType = String(body?.staffType || "ENFORCER");
  const status = String(body?.status || "ACTIVE");
  const contractEndAt = body?.contractEndAt ? String(body.contractEndAt) : null;

  if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  if (!["ENFORCER", "AUTHORITY"].includes(staffType)) return NextResponse.json({ error: "invalid staffType" }, { status: 400 });
  if (!["ACTIVE", "SUSPENDED", "REVOKED"].includes(status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });

  try {
    await db.doc(`employeeCredentials/${employeeId}`).set(
      {
        employeeId,
        staffType,
        status,
        contractEndAt: contractEndAt || null,
        updatedAt: AdminFieldValue.serverTimestamp(),
        createdAt: AdminFieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await writeAudit("admin:upsertEmployee", {
      actorUid: v.uid,
      actorEmail: v.email,
      employeeId,
      target: `employeeCredentials/${employeeId}`,
    });

    return NextResponse.json({ ok: true, employeeId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save employee" }, { status: 500 });
  }
}