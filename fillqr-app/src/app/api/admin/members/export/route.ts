import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  const tenantId = user.tenantId;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search") || undefined;
  const departmentId = searchParams.get("departmentId") || undefined;
  const membershipTypeId = searchParams.get("membershipTypeId") || undefined;

  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status;
  if (membershipTypeId) where.membershipTypeId = membershipTypeId;
  if (departmentId) {
    where.departments = { some: { departmentId } };
  }
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const members = await prisma.member.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      membershipType: { select: { name: true, fee: true } },
      departments: {
        include: { department: { select: { name: true } } },
      },
      sepaMandate: { select: { iban: true } },
    },
  });

  // CSV mit BOM fuer Excel
  const BOM = "\uFEFF";
  const header = "Mitgliedsnr;Name;E-Mail;Telefon;Status;Mitgliedstyp;Beitrag;Sparten;Zahlungsart;Zahlungsintervall;IBAN;Fotoerlaubnis;Newsletter;Ehrenamt;Spende;Geworben von;Eintrittsdatum;Erstellt";
  const rows = members.map((m) => {
    const name = `${m.firstName} ${m.lastName}`;
    const typ = m.membershipType?.name ?? "";
    const fee = m.membershipType ? Number(m.membershipType.fee).toFixed(2) : "";
    const sparten = m.departments.map((d) => d.department.name).join(", ");
    const entry = m.entryDate ? m.entryDate.toLocaleDateString("de-DE") : "";
    const created = m.createdAt.toLocaleDateString("de-DE");
    // IBAN maskiert (Finding 2: DSGVO)
    const iban = m.sepaMandate?.iban
      ? m.sepaMandate.iban.slice(0, 4) + "****" + m.sepaMandate.iban.slice(-4)
      : "";

    return [
      m.memberNo?.toString() ?? "",
      name,
      m.email,
      m.phone ?? "",
      m.status,
      typ,
      fee,
      sparten,
      m.paymentMethod ?? "",
      m.paymentInterval ?? "",
      iban,
      m.photoConsent != null ? (m.photoConsent ? "Ja" : "Nein") : "",
      m.newsletter != null ? (m.newsletter ? "Ja" : "Nein") : "",
      m.volunteer != null ? (m.volunteer ? "Ja" : "Nein") : "",
      m.donation != null ? Number(m.donation).toFixed(2) : "",
      m.referredBy ?? "",
      entry,
      created,
    ]
      .map((v) => `"${(v ?? "").replace(/"/g, '""')}"`)
      .join(";");
  });

  const csv = BOM + header + "\n" + rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mitglieder-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
