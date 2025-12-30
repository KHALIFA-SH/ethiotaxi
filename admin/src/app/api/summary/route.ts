import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, verifyAdminFromRequest } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const gate = await verifyAdminFromRequest(req);
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

  const db = getAdminDb();

  // IMPORTANT: use .get().size for emulator stability (avoid aggregate count weirdness)
  const [vehiclesSnap, employeesSnap, stationsSnap] = await Promise.all([
    db.collection("vehicles").get(),
    db.collection("employeeCredentials").get(), // your existing system uses this
    db.collection("stations").get(),
  ]);

  return NextResponse.json(
    {
      ok: true,
      counts: {
        vehicles: vehiclesSnap.size,
        employees: employeesSnap.size,
        stations: stationsSnap.size,
      },
      ts: Date.now(),
    },
    { status: 200 }
  );
}