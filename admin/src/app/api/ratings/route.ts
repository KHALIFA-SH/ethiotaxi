import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

function asStr(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

export async function GET(req: NextRequest) {
  const v = await verifyAdminFromRequest(req);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const { searchParams } = new URL(req.url);
  const plate = asStr(searchParams.get("plate")).toUpperCase();
  const trustLevel = asStr(searchParams.get("trustLevel")); // VERIFIED|UNVERIFIED

  // For demo scale: just fetch last 200 then filter
  const snap = await adminDb.collection("vehicleRatings").orderBy("createdAt", "desc").limit(200).get();
  let rows = snap.docs.map((d) => ({ ratingId: d.id, ...d.data() }));

  if (plate) rows = rows.filter((r: any) => String(r.plate || "").toUpperCase().includes(plate));
  if (trustLevel) rows = rows.filter((r: any) => String(r.trustLevel || "") === trustLevel);

  return NextResponse.json({ rows });
}
