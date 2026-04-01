import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  const tenantId = user.tenantId;

  let body: { rows: Record<string, string>[]; mapping: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
  }

  const { rows, mapping } = body;
  if (!rows?.length || !mapping) {
    return NextResponse.json({ error: "Keine Daten oder Mapping fehlt" }, { status: 400 });
  }

  // Pflicht-Mapping pruefen
  if (!mapping.firstName || !mapping.lastName || !mapping.email) {
    return NextResponse.json(
      { error: "Mapping fuer Vorname, Nachname und E-Mail ist Pflicht" },
      { status: 400 },
    );
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Einmal MAX(member_no) holen (Finding 3: effizienter)
  const highest = await prisma.member.findFirst({
    where: { tenantId, memberNo: { not: null } },
    orderBy: { memberNo: "desc" },
    select: { memberNo: true },
  });
  let nextNo = (highest?.memberNo ?? 0) + 1;

  // Bestehende Emails laden fuer Duplikat-Check
  const existingEmails = new Set(
    (await prisma.member.findMany({
      where: { tenantId },
      select: { email: true },
    })).map((m) => m.email.toLowerCase()),
  );

  // Import in Transaction
  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const firstName = row[mapping.firstName]?.trim();
        const lastName = row[mapping.lastName]?.trim();
        const email = row[mapping.email]?.trim().toLowerCase();

        if (!firstName || !lastName || !email) {
          errors.push(`Zeile ${i + 1}: Name oder E-Mail fehlt`);
          continue;
        }

        if (existingEmails.has(email)) {
          skipped++;
          continue;
        }

        try {
          await tx.member.create({
            data: {
              tenantId,
              firstName,
              lastName,
              email,
              phone: mapping.phone ? row[mapping.phone]?.trim() || null : null,
              street: mapping.street ? row[mapping.street]?.trim() || null : null,
              zip: mapping.zip ? row[mapping.zip]?.trim() || null : null,
              city: mapping.city ? row[mapping.city]?.trim() || null : null,
              status: "angenommen",
              memberNo: nextNo++,
            },
          });
          existingEmails.add(email);
          imported++;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            skipped++;
          } else {
            errors.push(`Zeile ${i + 1}: ${err instanceof Error ? err.message : "Fehler"}`);
          }
        }
      }
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Import fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ imported, skipped, errors: errors.slice(0, 20) });
}
