import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, verifyAdminFromRequest, AdminFieldValue } from "@/lib/firebaseAdmin";
import { writeAudit } from "@/lib/audit";

function asStr(v: any) {
  return typeof v === "string" ? v.trim() : "";
}
function asInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

export async function POST(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const body = await req.json().catch(() => ({}));
  const uid = asStr(body.uid);
  const role = asStr(body.role);

  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
  if (!["DRIVER", "ENFORCER", "AUTHORITY", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }

  const employeeId = asStr(body.employeeId) || null;
  const contractEndAtMillis = body.contractEndAtMillis ? asInt(body.contractEndAtMillis) : NaN;
  const contractEndAt = Number.isFinite(contractEndAtMillis) ? new Date(contractEndAtMillis) : null;

  if ((role === "ENFORCER" || role === "AUTHORITY") && !employeeId) {
    return NextResponse.json({ error: "employeeId required for ENFORCER/AUTHORITY" }, { status: 400 });
  }

  if (employeeId) {
    const empSnap = await adminDb.doc(`employeeCredentials/${employeeId}`).get();
    if (!empSnap.exists) return NextResponse.json({ error: "employee not found" }, { status: 404 });
  }

  const claims: any = {
    role,
    driver: role === "DRIVER",
    enforcer: role === "ENFORCER",
    authority: role === "AUTHORITY",
    admin: role === "ADMIN",
  };

  await adminAuth.setCustomUserClaims(uid, claims);

  await adminDb.doc(`users/${uid}`).set(
    {
      role,
      employeeId: employeeId,
      contractEndAt: contractEndAt ? contractEndAt : null,
      updatedAt: AdminFieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await writeAudit({
    action: "admin:approveUserRole",
    actorUid: v.uid,
    actorEmail: v.email || null,
    targetPath: `users/${uid}`,
    employeeId,
    meta: { role, contractEndAtMillis: Number.isFinite(contractEndAtMillis) ? contractEndAtMillis : null },
  });

  return NextResponse.json({ ok: true });
}
