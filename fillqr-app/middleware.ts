import { NextRequest, NextResponse } from "next/server";
import { extractSubdomain, isReserved } from "@/lib/tenant";

// Cookie-Namen direkt definieren (NICHT aus session/betreiber-session importieren,
// da diese iron-session + cookies() importieren — inkompatibel mit Edge Runtime)
const SESSION_COOKIE_NAME = "fillqr_session";
const BETREIBER_COOKIE_NAME = "fillqr_betreiber";

/** Exakte Pfade die ohne Login erreichbar sein muessen (Kunden-App) */
const PUBLIC_PATHS = new Set(["/login", "/logout", "/api/health", "/", "/vereinsbuddy/success"]);

/** Pfad-Prefixe die oeffentlich bleiben (Kunden-App) */
const PUBLIC_PREFIXES = ["/f/", "/api/"];

/** Betreiber-Pfade die ohne Betreiber-Session erreichbar sind */
const BETREIBER_PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/betreiber-login",
  "/api/health",
]);

/** Pfade die NUR ueber admin.fillqr.de erreichbar sein sollen */
const BETREIBER_ONLY_PREFIXES = ["/tenants"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isBetreiberPublicPath(pathname: string): boolean {
  if (BETREIBER_PUBLIC_PATHS.has(pathname)) return true;
  return pathname.startsWith("/api/");
}

function isBetreiberHost(host: string): boolean {
  const hostname = host.split(":")[0].toLowerCase();
  return hostname === "admin.fillqr.de" || hostname === "admin.localhost";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";


  // --- Betreiber-Panel: admin.fillqr.de ---
  if (isBetreiberHost(host)) {
    // Auth-Guard: Betreiber-Cookie pruefen auf nicht-oeffentlichen Pfaden
    if (!isBetreiberPublicPath(pathname)) {
      const betreiberCookie = request.cookies.get(BETREIBER_COOKIE_NAME);
      if (!betreiberCookie) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    // x-betreiber Header als Request-Header setzen (nicht Response-Header!)
    // Server Components lesen headers() = Request-Headers
    const betreiberHeaders = new Headers(request.headers);
    betreiberHeaders.set("x-betreiber", "true");
    return NextResponse.next({ request: { headers: betreiberHeaders } });
  }

  // --- Sicherheit: /tenants/* von Nicht-Admin-Hosts blockieren ---
  if (BETREIBER_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // --- Kunden-App: Bestehende Logik ---
  // Request-Headers klonen um x-tenant-slug fuer Server Components sichtbar zu machen
  const requestHeaders = new Headers(request.headers);

  try {
    let slug = extractSubdomain(host);

    // Dev-Fallback: ?tenant=slug wenn kein Subdomain-Routing
    if (!slug && process.env.NODE_ENV === "development") {
      slug = request.nextUrl.searchParams.get("tenant");
    }

    // Demo-Subdomain: Sonderfall — bleibt "reserved" (kein User-Slug),
    // aber Middleware setzt x-tenant-slug trotzdem (fuer Demo-Tenant)
    if (slug === "demo") {
      requestHeaders.set("x-tenant-slug", "demo");
    } else if (slug && !isReserved(slug)) {
      requestHeaders.set("x-tenant-slug", slug);
    }
  } catch (error) {
    console.error("Tenant middleware error:", error);
  }

  // Auth-Guard: Cookie-Existenz pruefen (kein Decrypt)
  if (!isPublicPath(pathname)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      // Dev-Mode: ?tenant= Param erhalten damit Login-Page den Tenant kennt
      if (process.env.NODE_ENV === "development") {
        const tenant = request.nextUrl.searchParams.get("tenant");
        if (tenant) loginUrl.searchParams.set("tenant", tenant);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
