import { NextRequest, NextResponse } from "next/server";

const COOKIE = "session";

function hasSession(req: NextRequest) {
  const v = req.cookies.get(COOKIE)?.value;
  return !!(v && v.length > 10);
}

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/sign-in")) return true;

  // allow session endpoints without cookie so login can set it
  if (pathname.startsWith("/api/session")) return true;

  // static
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|map)$/i)) return true;

  return false;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  if (!hasSession(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + (search || ""))}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};