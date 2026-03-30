import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { resolveAppKeyForLogin } from "@/lib/get-tenant";

/**
 * Login via klassischem Form-POST.
 * Setzt Cookie + Redirect in einer atomaren Response —
 * zuverlaessiger als fetch() + window.location.href.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const password = formData.get("password") as string | null;

  // Origin aus X-Forwarded-Headers (Caddy) oder Fallback
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "app.fillqr.de";
  const baseUrl = `${proto}://${host}`;

  if (!email || !password) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("E-Mail und Passwort eingeben")}`,
      303
    );
  }

  const user = await prisma.appUser.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("E-Mail oder Passwort falsch")}`,
      303
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { status: true },
  });

  if (!tenant || (tenant.status !== "active" && tenant.status !== "trial")) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("Konto deaktiviert")}`,
      303
    );
  }

  // appKey aus Subdomain oder Fallback (erste aktive App)
  const appKey = await resolveAppKeyForLogin(host, user.tenantId);

  if (!appKey) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("Kein Produkt zugeordnet")}`,
      303
    );
  }

  const session = await getSession();
  session.userId = user.id;
  session.tenantId = user.tenantId;
  session.email = user.email;
  session.appKey = appKey;
  await session.save();

  return NextResponse.redirect(`${baseUrl}/admin/dashboard`, 303);
}
