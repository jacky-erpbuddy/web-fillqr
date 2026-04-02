import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { validateTurnstile } from "@/lib/turnstile";
import { parseSettings } from "@/lib/settings-schema";
import { sendTemplatedMail } from "@/lib/email";

/** IBAN-Pruefziffer Modulo 97 (nur DE) */
function validateIbanChecksum(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (!/^DE\d{20}$/.test(cleaned)) return false;
  // Erste 4 Zeichen ans Ende
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  // Buchstaben → Zahlen (A=10, B=11, ..., Z=35)
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  // Modulo 97 (chunk-basiert, kein BigInt noetig)
  let remainder = 0;
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + parseInt(numeric[i], 10)) % 97;
  }
  return remainder === 1;
}

const sepaSchema = z.object({
  accountHolder: z.string().min(1, "Kontoinhaber ist Pflicht"),
  iban: z.string().min(1, "IBAN ist Pflicht"),
  bic: z.string().optional(),
  mandateConsent: z.literal(true, {
    message: "SEPA-Mandat muss erteilt werden",
  }),
});

const guardianSchema = z.object({
  firstName: z.string().min(1, "Vorname Erziehungsberechtigte/r ist Pflicht"),
  lastName: z.string().min(1, "Nachname Erziehungsberechtigte/r ist Pflicht"),
  email: z.string().email("Ungueltige E-Mail Erziehungsberechtigte/r"),
  phone: z.string().optional(),
  street: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  consent: z.literal(true, {
    message: "Zustimmung Erziehungsberechtigte/r ist Pflicht",
  }),
});

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
  guardian: guardianSchema.optional(),
  paymentMethod: z.enum(["sepa", "ueberweisung", "bar"]).optional(),
  sepa: sepaSchema.optional(),
  photoConsent: z.boolean().optional(),
  newsletter: z.boolean().optional(),
  volunteer: z.boolean().optional(),
  donation: z.number().min(0).optional(),
  referredBy: z.string().optional(),
  photoPath: z.string().optional(),
  familyMembers: z.array(z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    birthdate: z.string().min(1),
    departmentIds: z.array(z.string()).default([]),
    photoPath: z.string().optional(),
  })).optional(),
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

  // 5b. Minderjaehrigen-Check: Guardian Pflicht wenn Alter < 18
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const monthDiff = now.getMonth() - birthdate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthdate.getDate())) {
    age--;
  }
  if (age < 18 && !data.guardian) {
    return NextResponse.json(
      { error: "Erziehungsberechtigte/r ist bei Minderjaehrigen Pflicht" },
      { status: 400 },
    );
  }

  // Settings laden (einmalig fuer alle Validierungen)
  const settings = parseSettings(tenantApp.settingsJson);

  // 5c. Zahlungsart gegen Settings pruefen (Finding 3)
  if (data.paymentMethod) {
    const allowed: string[] = [];
    if (settings.sepa_aktiv) allowed.push("sepa");
    if (settings.zahlungsarten.ueberweisung) allowed.push("ueberweisung");
    if (settings.zahlungsarten.bar) allowed.push("bar");
    if (!allowed.includes(data.paymentMethod)) {
      return NextResponse.json(
        { error: "Gewaehlte Zahlungsart ist nicht aktiviert" },
        { status: 400 },
      );
    }
  }

  // 5d. SEPA-Validierung: IBAN Pruefziffer (Server-seitig)
  if (data.paymentMethod === "sepa") {
    if (!data.sepa) {
      return NextResponse.json(
        { error: "SEPA-Daten sind bei Lastschrift Pflicht" },
        { status: 400 },
      );
    }
    if (!validateIbanChecksum(data.sepa.iban)) {
      return NextResponse.json(
        { error: "IBAN ist ungueltig (Pruefziffer fehlerhaft)" },
        { status: 400 },
      );
    }
  }

  // 5e. Foto Pflicht-Check (Server-Validierung — Finding 3)
  if (settings.foto_upload === "pflicht" && !data.photoPath) {
    return NextResponse.json(
      { error: "Foto ist Pflicht" },
      { status: 400 },
    );
  }

  const entryDate = data.entryDate ? new Date(data.entryDate) : null;

  // 6. Prisma Transaction: Member + MemberDepartments + Guardian + SepaMandate
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
        paymentMethod: data.paymentMethod || null,
        photoConsent: data.photoConsent ?? null,
        newsletter: data.newsletter ?? null,
        volunteer: data.volunteer ?? null,
        donation: data.donation ?? null,
        referredBy: data.referredBy || null,
        photoPath: data.photoPath || null,
        familyGroupId: data.familyMembers?.length ? undefined : null, // wird unten gesetzt wenn Familie
        familyHead: data.familyMembers?.length ? true : null,
        status: "eingegangen",
      },
    });

    // Familien-Logik: familyGroupId setzen + weitere Members anlegen
    if (data.familyMembers && data.familyMembers.length > 0) {
      const groupId = newMember.id; // Head-ID als GroupID
      await tx.member.update({
        where: { id: newMember.id },
        data: { familyGroupId: groupId },
      });

      for (const fm of data.familyMembers) {
        const fmBirthdate = new Date(fm.birthdate);
        const fmMember = await tx.member.create({
          data: {
            tenantId: tenant.id,
            firstName: fm.firstName,
            lastName: fm.lastName,
            email: data.email, // Familie teilt E-Mail des Heads
            birthdate: fmBirthdate,
            membershipTypeId: data.membershipTypeId,
            paymentInterval: data.paymentInterval,
            paymentMethod: data.paymentMethod || null,
            photoPath: fm.photoPath || null,
            familyGroupId: groupId,
            familyHead: false,
            status: "eingegangen",
          },
        });

        // Sparten fuer Familienmitglied
        if (fm.departmentIds.length > 0) {
          await tx.memberDepartment.createMany({
            data: fm.departmentIds.map((deptId) => ({
              memberId: fmMember.id,
              departmentId: deptId,
            })),
          });
        }
      }
    }

    // Sparten zuordnen
    if (data.departmentIds.length > 0) {
      await tx.memberDepartment.createMany({
        data: data.departmentIds.map((deptId) => ({
          memberId: newMember.id,
          departmentId: deptId,
        })),
      });
    }

    // Guardian speichern (bei Minderjaehrigen)
    if (data.guardian) {
      await tx.guardian.create({
        data: {
          memberId: newMember.id,
          firstName: data.guardian.firstName,
          lastName: data.guardian.lastName,
          email: data.guardian.email,
          phone: data.guardian.phone || null,
          street: data.guardian.street || null,
          zip: data.guardian.zip || null,
          city: data.guardian.city || null,
        },
      });
    }

    // SEPA-Mandat erstellen (mit Retry bei UNIQUE Conflict — Finding 2)
    if (data.paymentMethod === "sepa" && data.sepa) {
      let mandateCreated = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const count = await tx.sepaMandate.count({ where: { tenantId: tenant.id } });
          const mandateRef = `FILLQR-${tenant.id.slice(0, 6).toUpperCase()}-${count + 1}`;
          await tx.sepaMandate.create({
            data: {
              memberId: newMember.id,
              tenantId: tenant.id,
              accountHolder: data.sepa.accountHolder,
              iban: data.sepa.iban.replace(/\s/g, "").toUpperCase(),
              bic: data.sepa.bic || null,
              mandateRef,
            },
          });
          mandateCreated = true;
          break;
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002" &&
            attempt < 2
          ) {
            continue;
          }
          throw err;
        }
      }
      if (!mandateCreated) {
        throw new Error("Mandatsreferenz konnte nicht generiert werden");
      }
    }

    return newMember;
  });

  // 7. E-Mails via DB-Templates (async, nicht blockierend)
  const templateVars = {
    vereinsname: tenant.name,
    vorname: data.firstName,
    nachname: data.lastName,
    mitgliedsname: `${data.firstName} ${data.lastName}`,
    email: data.email,
  };

  // An Antragsteller
  sendTemplatedMail(prisma, tenant.id, "member_confirm", data.email, templateVars)
    .catch((err) => console.error("[SUBMIT] Bestaetigungsmail fehlgeschlagen:", err));

  // An Admin (tbl_tenants.email)
  if (tenant.email) {
    sendTemplatedMail(prisma, tenant.id, "admin_notify", tenant.email, templateVars)
      .catch((err) => console.error("[SUBMIT] Admin-Notification fehlgeschlagen:", err));
  }

  // 8. Demo-Notification: Jacky informieren wenn jemand die Demo nutzt
  if (slug === "demo" && process.env.TELEGRAM_BOT_TOKEN) {
    const chatId = "1107931167";
    const text = `Demo-Formular: ${data.firstName} ${data.lastName} hat einen Antrag abgeschickt (demo.fillqr.de)`;
    fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }).catch((err) => console.error("[SUBMIT] Demo-Notification fehlgeschlagen:", err));
  }

  return NextResponse.json({ success: true, memberId: member.id });
}
