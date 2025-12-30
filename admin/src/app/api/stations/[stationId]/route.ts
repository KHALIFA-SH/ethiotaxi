import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb, AdminFieldValue, verifyAdminFromRequest } from "@/lib/firebaseAdmin";
import { writeAudit } from "@/lib/audit";

const Body = z.object({ nameAm: z.string().min(1), nameEn: z.string().min(1), lat: z.number(), lng: z.number() });

export async function POST(req: Request, { params }: { params: { stationId: string } }) {
  try {
    const actor = await verifyAdminFromRequest(req);
    const stationId = String(params.stationId || "").toUpperCase();
    const body = Body.parse(await req.json());

    const ref = adminDb.doc(`stations/${stationId}`);
    const snap = await ref.get();
    if (!snap.exists) return new NextResponse("Station not found", { status: 404 });

    await ref.set({ ...body, updatedAt: AdminFieldValue.serverTimestamp() }, { merge: true });

    await writeAudit({
      action: "admin:updateStation",
      actorUid: actor.uid,
      actorRoles: { admin: actor.admin === true },
      stationId,
      target: `stations/${stationId}`,
      meta: body
    });

    const updated = await ref.get();
    return NextResponse.json({ station: { stationId, ...(updated.data() as any) } });
  } catch (e: any) {
    return new NextResponse(e.message || "Bad Request", { status: 400 });
  }
}
