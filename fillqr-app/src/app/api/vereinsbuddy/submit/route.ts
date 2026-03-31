import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { validateTurnstile } from "@/lib/turnstile";
import {
  sendMail,
  buildMemberConfirmEmail,
  buildMemberNotifyEmail,
} from "@/lib/email";

const submitSchema = z.object({
  turnstileToken: z.string().min(1),
  firstName: z.string().min(1, "Vorname ist Pflicht"),
  lastName: z.string().min(1, "Nachname ist Pflicht"),
  street: z.string().min(1, "Strasse ist Pflicht"),
  zip: z.string().min(1, "PLZ ist Pflicht"),
  city: z.string().min(1, "Ort ist Pflicht"),
  email: z.string().email("Ungueltige E-Mail"),
  birthdate: z.string().min(1, "Geburtsdatum ist Pflicht"),
  phone: z.string().optional(),
  membershipTypeId: z.string().min(1, "Mitgliedstyp ist Pflicht"),
  paymentInterval: z.string().min(1, "Zahlungsintervall ist Pflicht"),
  entryDate: z.string().optional(),
  departmentIds: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  // 1. Body parsen
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltige Anfrage" },
      { status: 400 },
    );
  }

  // 2. Zod-Validierung
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Validierungsfehler";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const data = parsed.data;

  // 3. Turnstile validieren
  const valid = await validateTurnstile(data.turnstileToken);
  if (!valid) {
    return NextResponse.json(
      { error: "Sicherheitspruefung fehlgeschlagen" },
      { status: 400 },
    );
  }

  // 4. Tenant aus Header
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");
  if (!slug) {
    return NextResponse.json({ error: "Kein Tenant" }, { status: 400 });
  }

  const tenantApp = await prisma.tenantApp.findUnique({
    where: { slug },
    include: { tenant: true },
  });

  if (!tenantApp || !tenantApp.isEnabled) {
    return NextResponse.json(
      { error: "Tenant nicht gefunden" },
      { status: 404 },
    );
  }

  const tenant = tenantApp.tenant;

  // 5. Datum-Plausibilitaet
  const birthdate = new Date(data.birthdate);
  if (isNaN(birthdate.getTime()) || birthdate > new Date()) {
    return NextResponse.json(
      { error: "Ungueltiges Geburtsdatum" },
      { status: 400 },
    );
  }

  const entryDate = data.entryDate ? new Date(data.entryDate) : null;

  // 6. Prisma Transaction: Member + MemberDepartments
  const member = await prisma.$transaction(async (tx) => {
    const newMember = await tx.member.create({
      data: {
        tenantId: tenant.id,
        firstName: data.firstName,
        lastName: data.lastName,
        street: data.street,
        zip: data.zip,
        city: data.city,
        email: data.email,
        phone: data.phone || null,
        birthdate,
        entryDate,
        membershipTypeId: data.membershipTypeId,
        paymentInterval: data.paymentInterval,
        status: "eingegangen",
      },
    });

    // Sparten zuordnen
    if (data.departmentIds.length > 0) {
      await tx.memberDepartment.createMany({
        data: data.departmentIds.map((deptId) => ({
          memberId: newMember.id,
          departmentId: deptId,
        })),
      });
    }

    return newMember;
  });

  // 7. E-Mails (async, nicht blockierend)
  const tenantName = tenant.name;

  // An Antragsteller
  try {
    const { subject, html } = buildMemberConfirmEmail(tenantName);
    await sendMail(data.email, subject, html);
  } catch (err) {
    console.error("[SUBMIT] Bestaetigungsmail fehlgeschlagen:", err);
  }

  // An Admin (tbl_tenants.email)
  if (tenant.email) {
    try {
      const { subject, html } = buildMemberNotifyEmail(
        tenantName,
        data.firstName,
        data.lastName,
        data.email,
      );
      await sendMail(tenant.email, subject, html);
    } catch (err) {
      console.error("[SUBMIT] Admin-Notification fehlgeschlagen:", err);
    }
  }

  return NextResponse.json({ success: true, memberId: member.id });
}
