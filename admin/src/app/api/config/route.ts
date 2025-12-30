import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, AdminFieldValue, verifyAdminFromRequest } from "@/lib/firebaseAdmin";
import { writeAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const db = getAdminDb();
  try {
    const doc = await db.doc("config/app").get();
    return NextResponse.json({ doc: doc.exists ? doc.data() : null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load config" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const db = getAdminDb();
  const body = await req.json().catch(() => ({}));

  try {
    await db.doc("config/app").set(
      {
        ...body,
        updatedAt: AdminFieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await writeAudit("admin:updateConfig", {
      actorUid: v.uid,
      actorEmail: v.email,
      target: "config/app",
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save config" }, { status: 500 });
  }
}