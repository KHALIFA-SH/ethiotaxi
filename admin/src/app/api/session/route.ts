import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

function isProd() {
  return process.env.NODE_ENV === "production";
}

function sessionMinutes() {
  const v = process.env.SESSION_TIMEOUT_MINUTES || "15";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

const COOKIE = "session";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(COOKIE)?.value;
  if (!cookie) return NextResponse.json({ ok: false, error: "NOT_SIGNED_IN" }, { status: 401 });

  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    return NextResponse.json(
      { ok: true, uid: decoded.uid, email: (decoded as any).email || null },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "SESSION_INVALID" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const idToken = body?.idToken;
    if (!idToken) return NextResponse.json({ ok: false, error: "MISSING_ID_TOKEN" }, { status: 400 });

    const expiresIn = sessionMinutes() * 60 * 1000;
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(COOKIE, sessionCookie, {
      httpOnly: true,
      secure: isProd(),
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(expiresIn / 1000),
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "SESSION_CREATE_FAILED" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}