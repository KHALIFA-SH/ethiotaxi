import { NextResponse } from "next/server";
import { adminEnvSummary } from "@/lib/firebaseAdmin";

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: adminEnvSummary(),
  });
}