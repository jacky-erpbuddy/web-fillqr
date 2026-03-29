import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let dbStatus = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    dbStatus = "error";
  }

  const status = dbStatus === "connected" ? "ok" : "degraded";
  return NextResponse.json({
    status,
    service: "fillqr-app",
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
}
