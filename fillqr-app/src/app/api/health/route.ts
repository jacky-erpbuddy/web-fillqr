import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  let dbStatus = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "error";
  }

  const status = dbStatus === "connected" ? "ok" : "degraded";
  const sessionCookie = request.cookies.get("fillqr_session");
  return NextResponse.json({
    status,
    service: "fillqr-app",
    db: dbStatus,
    timestamp: new Date().toISOString(),
    debug_session_cookie: sessionCookie ? "present" : "missing",
  });
}
