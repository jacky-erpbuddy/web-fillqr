import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { getBetreiberSession } from "@/lib/betreiber-session";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = formData.get("password") as string | null;

  const proto =
    request.headers.get("x-forwarded-proto") ?? "https";
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "admin.fillqr.de";
  const baseUrl = `${proto}://${host}`;

  if (!password) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("Passwort eingeben")}`,
      303,
    );
  }

  const hash = process.env.BETREIBER_PASSWORD_HASH;
  if (!hash) {
    console.error("[BETREIBER-LOGIN] BETREIBER_PASSWORD_HASH nicht gesetzt");
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("Serverfehler")}`,
      303,
    );
  }

  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent("Ungültiges Passwort")}`,
      303,
    );
  }

  const session = await getBetreiberSession();
  session.isBetreiber = true;
  await session.save();

  return NextResponse.redirect(`${baseUrl}/tenants`, 303);
}
