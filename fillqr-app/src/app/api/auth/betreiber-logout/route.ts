import { NextRequest, NextResponse } from "next/server";
import { destroyBetreiberSession } from "@/lib/betreiber-session";

export async function POST(request: NextRequest) {
  await destroyBetreiberSession();

  const proto =
    request.headers.get("x-forwarded-proto") ?? "https";
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "admin.fillqr.de";
  const baseUrl = `${proto}://${host}`;

  return NextResponse.redirect(`${baseUrl}/login`, 303);
}
