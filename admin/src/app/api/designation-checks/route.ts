import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const snap = await adminDb.collection("designationChecks").orderBy("checkedAt", "desc").limit(200).get();
  const rows = snap.docs.map((d) => ({ checkId: d.id, ...d.data() }));
  return NextResponse.json({ rows });
}
