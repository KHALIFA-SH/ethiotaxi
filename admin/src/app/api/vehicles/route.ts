import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

function norm(s: string) {
  return String(s || "").trim().toUpperCase();
}

export async function GET(req: NextRequest) {
  const gate = await verifyAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const db = getAdminDb();
  const url = new URL(req.url);

  const plateQ = norm(url.searchParams.get("plate") || "");
  const tapelaQ = norm(url.searchParams.get("tapela") || "");

  // Fetch a bounded list then filter in-memory to avoid Firestore composite index pain.
  // Admin UI volumes are low; this is stable for emulator + early prod.
  const snap = await db.collection("vehicles").orderBy("updatedAt", "desc").limit(500).get();

  let rows = snap.docs.map((d) => {
    const data = d.data() || {};
    return {
      plate: d.id,
      seatCapacity: data.seatCapacity ?? null,
      status: data.status ?? "ACTIVE",
      vin: data.vin ?? "",
      tapela: data.tapela ?? "",
      ownerName: data.ownerName ?? "",
      ownerPhone: data.ownerPhone ?? "",
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
    };
  });

  if (plateQ) {
    rows = rows.filter((r) => norm(r.plate).startsWith(plateQ));
  }
  if (tapelaQ) {
    // tapela is optional metadata; allow contains-match to be useful
    rows = rows.filter((r) => norm(r.tapela || "").includes(tapelaQ));
  }

  return NextResponse.json({ ok: true, rows }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const gate = await verifyAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const db = getAdminDb();
  const body = await req.json().catch(() => null);

  const mode = String(body?.mode || "upsert"); // "create" | "upsert"
  const plate = norm(body?.plate || "");
  const seatCapacity = Number(body?.seatCapacity);

  if (!plate) return NextResponse.json({ ok: false, error: "PLATE_REQUIRED" }, { status: 400 });
  if (!Number.isFinite(seatCapacity) || seatCapacity <= 0) {
    return NextResponse.json({ ok: false, error: "SEAT_CAPACITY_REQUIRED" }, { status: 400 });
  }

  const docRef = db.collection("vehicles").doc(plate);
  const exists = (await docRef.get()).exists;

  if (mode === "create" && exists) {
    return NextResponse.json({ ok: false, error: "PLATE_ALREADY_EXISTS" }, { status: 409 });
  }

  const now = new Date();

  await docRef.set(
    {
      // keep plate as docId; also store optional fields
      seatCapacity,
      status: body?.status || "ACTIVE",
      vin: String(body?.vin || "").trim(),
      tapela: String(body?.tapela || "").trim(),
      ownerName: String(body?.ownerName || "").trim(),
      ownerPhone: String(body?.ownerPhone || "").trim(),
      updatedAt: now,
      ...(exists ? {} : { createdAt: now }),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true }, { status: 200 });
}