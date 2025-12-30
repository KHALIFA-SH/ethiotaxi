import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb, AdminFieldValue, verifyAdminFromRequest } from "@/lib/firebaseAdmin";
import { writeAudit } from "@/lib/audit";

const Body = z.object({ uid: z.string().min(1), employeeId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const actor = await verifyAdminFromRequest(req);
    if (actor.admin !== true) return new NextResponse("Requires ADMIN claim", { status: 403 });

    const body = Body.parse(await req.json());
    const uid = body.uid.trim();
    const employeeId = body.employeeId.trim();

    const empSnap = await adminDb.doc(`employeeCredentials/${employeeId}`).get();
    if (!empSnap.exists) return new NextResponse("employeeId not found", { status: 404 });

    const userRec = await adminAuth.getUser(uid);
    const current = (userRec.customClaims || {}) as any;
    const merged = { ...current, enforcer: true, employeeId };

    await adminAuth.setCustomUserClaims(uid, merged);

    await adminDb.doc(`users/${uid}`).set(
      { employeeId, roles: { ...(current.roles || {}), enforcer: true }, updatedAt: AdminFieldValue.serverTimestamp() },
      { merge: true }
    );

    await writeAudit({
      action: "admin:approveEnforcer",
      actorUid: actor.uid,
      actorRoles: { admin: true },
      target: `users/${uid}`,
      meta: { employeeId }
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return new NextResponse(e.message || "Bad Request", { status: 400 });
  }
}
