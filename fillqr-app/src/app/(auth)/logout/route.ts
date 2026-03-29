import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

/** Logout nur per POST — GET-Logout ist ein Anti-Pattern (Prefetch zerstoert Session). */
export async function POST(request: NextRequest) {
  await destroySession();

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "app.fillqr.de";
  return NextResponse.redirect(`${proto}://${host}/login`, 303);
}

/** GET-Requests auf /logout leiten nur weiter, zerstoeren NICHT die Session. */
export async function GET(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "app.fillqr.de";
  return NextResponse.redirect(`${proto}://${host}/login`, 303);
}
