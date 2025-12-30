import { NextResponse } from "next/server";
import { adminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";
import { writeAudit } from "@/lib/audit";

export async function DELETE(req: Request, { params }: { params: { employeeId: string } }) {
  try {
    const actor = await verifyAdminFromRequest(req);
    const employeeId = String(params.employeeId || "").trim();
    if (!employeeId) return new NextResponse("employeeId required", { status: 400 });

    await adminDb.doc(`employeeCredentials/${employeeId}`).delete();

    await writeAudit({
      action: "admin:deleteEmployee",
      actorUid: actor.uid,
      actorRoles: { admin: actor.admin === true },
      target: `employeeCredentials/${employeeId}`
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return new NextResponse(e.message || "Unauthorized", { status: 403 });
  }
}
