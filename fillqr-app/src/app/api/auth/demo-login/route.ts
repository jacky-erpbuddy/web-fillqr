import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * Auto-Login fuer Demo-Tenant (demo.fillqr.de).
 * Erstellt eine iron-session fuer den Demo-Admin-User und redirect zum Admin.
 * Nur aktiv wenn x-tenant-slug === "demo".
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

  // iron-session erstellen (Cookie-Domain = demo.fillqr.de, kein Wildcard)
  const session = await getSession();
  session.userId = demoUser.id;
  session.tenantId = tenantApp.tenantId;
  session.email = demoUser.email;
  session.appKey = tenantApp.app.key;
  await session.save();

  // Redirect via HTML (statt HTTP 303) — stellt sicher dass der Cookie
  // vom Browser gespeichert wird BEVOR die Navigation passiert
  const redirectPath = request.nextUrl.searchParams.get("redirect") || "/admin/dashboard";

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${redirectPath}"></head><body><p>Anmeldung...</p><script>window.location.href="${redirectPath}";</script></body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
