import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * TEMPORARY debug endpoint — tests login + cookie setting.
 * DELETE after debugging!
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 });
    }

    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "user not found" }, { status: 401 });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return NextResponse.json({ error: "wrong password" }, { status: 401 });
    }

    const session = await getSession();
    session.userId = user.id;
    session.tenantId = user.tenantId;
    session.email = user.email;
    session.role = user.role;
    await session.save();

    return NextResponse.json({
      ok: true,
      userId: user.id,
      message: "Session saved. Check Set-Cookie header.",
    });
  } catch (err: unknown) {
    return NextResponse.json({
      error: "internal",
      detail: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
