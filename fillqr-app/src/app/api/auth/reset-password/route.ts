import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
});

export async function POST(request: NextRequest) {
  let body;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request." },
      { status: 400 },
    );
  }

  const user = await prisma.appUser.findUnique({
    where: { resetToken: body.token },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Dieser Link ist ungueltig oder wurde bereits verwendet." },
      { status: 410 },
    );
  }

  if (!user.resetExpiresAt || user.resetExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "Dieser Link ist abgelaufen. Bitte fordere einen neuen an." },
      { status: 410 },
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 10);

  await prisma.appUser.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetExpiresAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
