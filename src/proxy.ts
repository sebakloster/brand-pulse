import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

// Optimistic gate: every page needs the session cookie. Server actions check
// again on their own (requireSession), since the proxy is not a security boundary.
export async function proxy(req: NextRequest) {
  if (await isValidSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const url = new URL("/login", req.url);
  const next = req.nextUrl.pathname + req.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login page, the cron endpoints (own secret) and static files.
  matcher: ["/((?!login|api/tick|api/digest|_next/static|_next/image|favicon.ico).*)"],
};
