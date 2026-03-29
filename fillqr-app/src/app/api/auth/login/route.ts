import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const password = body?.password as string | undefined;

  if (!email || !password) {
    return NextResponse.json(
      { error: "E-Mail und Passwort eingeben" },
      { status: 400 }
    );
  }

  const user = await prisma.appUser.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json(
      { error: "E-Mail oder Passwort falsch" },
      { status: 401 }
    );
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return NextResponse.json(
      { error: "E-Mail oder Passwort falsch" },
      { status: 401 }
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { status: true },
  });

  if (!tenant || (tenant.status !== "ACTIVE" && tenant.status !== "TRIAL")) {
    return NextResponse.json(
      { error: "Konto deaktiviert" },
      { status: 403 }
    );
  }

  const session = await getSession();
  session.userId = user.id;
  session.tenantId = user.tenantId;
  session.email = user.email;
  session.role = user.role;
  await session.save();

  return NextResponse.json({ ok: true });
}
