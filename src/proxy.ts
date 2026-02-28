import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "auth_token";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/verify-email",
  "/privacy",
  "/terms",
  "/kvkk",
  "/cookies",
]);

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const isApiRoute = pathname.startsWith("/api/");

  if (!isApiRoute) {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const isPublicPath = PUBLIC_PATHS.has(pathname);

    if (!token && !isPublicPath) {
      const loginUrl = new URL("/login", req.url);
      const nextValue = `${pathname}${search}`;
      if (nextValue !== "/") {
        loginUrl.searchParams.set("next", nextValue);
      }
      return NextResponse.redirect(loginUrl);
    }

    if (token && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)",
  ],
};
