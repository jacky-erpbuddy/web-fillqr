import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail, buildResetEmail } from "@/lib/email";

const schema = z.object({
  email: z.string().email(),
});

// Rate-Limiting: In-Memory (V1 Single-Process — nicht persistent ueber Restarts)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(email, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (entry.count >= 3) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { message: "Wenn ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet." },
      { status: 200 },
    );
  }

  const email = body.email.trim().toLowerCase();

  if (!checkRateLimit(email)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte eine Stunde." },
      { status: 429 },
    );
  }

  // Gleiche Response ob User existiert oder nicht (kein Account-Enumeration)
  const successResponse = NextResponse.json({
    message: "Wenn ein Konto mit dieser E-Mail existiert, wurde eine E-Mail gesendet.",
  });

  const user = await prisma.appUser.findUnique({
    where: { email },
    include: {
      tenant: {
        include: {
          tenantApps: {
            where: { isEnabled: true },
            select: { slug: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!user || user.tenant.tenantApps.length === 0) {
    return successResponse;
  }

  const resetToken = randomUUID();
  const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await prisma.appUser.update({
    where: { id: user.id },
    data: { resetToken, resetExpiresAt },
  });

  const slug = user.tenant.tenantApps[0].slug;
  const link = `https://${slug}.fillqr.de/reset-password?token=${resetToken}`;
  const { subject, html } = buildResetEmail(link);

  try {
    await sendMail(email, subject, html);
  } catch (err) {
    console.error("[RESET] Mail-Versand fehlgeschlagen:", err);
  }

  return successResponse;
}
