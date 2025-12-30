import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get("q") || "").trim().toLowerCase();

  // Minimal: list last 200 users then filter in memory (works fine for demo)
  const snap = await adminDb.collection("users").orderBy("updatedAt", "desc").limit(200).get();
  let rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

  if (q) {
    rows = rows.filter((r: any) => {
      const email = String(r.email || "").toLowerCase();
      const name = String(r.displayName || "").toLowerCase();
      const uid = String(r.uid || "").toLowerCase();
      return email.includes(q) || name.includes(q) || uid.includes(q);
    });
  }

  return NextResponse.json({ rows });
}
