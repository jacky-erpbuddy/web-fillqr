import { NextRequest, NextResponse } from "next/server";
import { extractSubdomain, isReserved } from "@/lib/tenant";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/** Exakte Pfade die ohne Login erreichbar sein muessen */
const PUBLIC_PATHS = new Set(["/login", "/logout", "/api/health", "/"]);

/** Pfad-Prefixe die oeffentlich bleiben */
const PUBLIC_PREFIXES = ["/f/", "/api/"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // --- Tenant-Slug aus Subdomain (bestehende Logik aus AP-08) ---
  try {
    const host = request.headers.get("host") ?? "";
    let slug = extractSubdomain(host);

    // Dev-Fallback: ?tenant=slug wenn kein Subdomain-Routing
    if (!slug && process.env.NODE_ENV === "development") {
      slug = request.nextUrl.searchParams.get("tenant");
    }

    if (slug && !isReserved(slug)) {
      response.headers.set("x-tenant-slug", slug);
    }
  } catch (error) {
    console.error("Tenant middleware error:", error);
  }

  // --- Auth-Guard: Cookie-Existenz pruefen (kein Decrypt) ---
  if (!isPublicPath(pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    console.log(`[MW] ${pathname} — cookie: ${sessionCookie ? "present" : "MISSING"}`);
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
