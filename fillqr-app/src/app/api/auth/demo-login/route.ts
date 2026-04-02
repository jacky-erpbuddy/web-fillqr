import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getIronSession } from "iron-session";
import { SessionData, SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * Auto-Login fuer Demo-Tenant (demo.fillqr.de).
 * Erstellt eine iron-session fuer den Demo-Admin-User und redirect zum Admin.
 * Nur aktiv wenn x-tenant-slug === "demo".
 *
 * Wichtig: Nutzt getIronSession(req, res) statt getSession() (cookies()),
 * weil cookies() den Set-Cookie-Header NICHT auf manuell konstruierte
 * NextResponse-Objekte uebertraegt → fuehrt sonst zu Redirect-Loop.
 */
export async function GET(request: NextRequest) {
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");

  // Sicherheit: Nur fuer Demo-Tenant
  if (slug !== "demo") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Demo-Tenant + User laden
  const tenantApp = await prisma.tenantApp.findUnique({
    where: { slug: "demo" },
    include: { tenant: true, app: true },
  });

  if (!tenantApp) {
    return NextResponse.json(
      { error: "Demo-Tenant nicht konfiguriert" },
      { status: 404 },
    );
  }

  const demoUser = await prisma.appUser.findFirst({
    where: { tenantId: tenantApp.tenantId },
  });

  if (!demoUser) {
    return NextResponse.json(
      { error: "Demo-User nicht konfiguriert" },
      { status: 404 },
    );
  }

  const redirectPath = request.nextUrl.searchParams.get("redirect") || "/admin/dashboard";

  // Redirect-URL mit externem Host bauen (request.url ist intern 0.0.0.0:3000 hinter Caddy)
  const host = headerList.get("host") || request.nextUrl.host;
  const proto = headerList.get("x-forwarded-proto") || (request.nextUrl.protocol === "https:" ? "https" : "http");
  const redirectUrl = new URL(redirectPath, `${proto}://${host}`);
  const response = NextResponse.redirect(redirectUrl);

  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET!,
    cookieName: SESSION_COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    },
  });

  session.userId = demoUser.id;
  session.tenantId = tenantApp.tenantId;
  session.email = demoUser.email;
  session.appKey = tenantApp.app.key;
  await session.save();

  return response;
}
