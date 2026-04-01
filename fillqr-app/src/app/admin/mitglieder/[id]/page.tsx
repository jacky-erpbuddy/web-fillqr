import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import StatusActions from "./StatusActions";

const STATUS_COLORS: Record<string, string> = {
  eingegangen: "bg-blue-100 text-blue-800",
  in_pruefung: "bg-yellow-100 text-yellow-800",
  angenommen: "bg-green-100 text-green-800",
  abgelehnt: "bg-red-100 text-red-800",
  gekuendigt: "bg-gray-100 text-gray-800",
};

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const member = await prisma.member.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      membershipType: { select: { name: true, fee: true } },
      departments: {
        include: { department: { select: { name: true, extraFee: true } } },
      },
      guardians: true,
      sepaMandate: true,
      tenant: {
        select: {
          name: true,
          tenantApps: { select: { slug: true }, take: 1 },
        },
      },
    },
  });

  if (!member) notFound();

  const history = Array.isArray(member.statusHistory)
    ? (member.statusHistory as { status: string; at: string }[])
    : [];

  const slug = member.tenant.tenantApps[0]?.slug;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/mitglieder"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Zurueck zur Liste
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {member.firstName} {member.lastName}
        </h1>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[member.status] ?? "bg-gray-100"}`}
        >
          {member.status}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Persoenliche Daten */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Persoenliche Daten
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="E-Mail" value={member.email} />
            <Row label="Strasse" value={member.street} />
            <Row
              label="Ort"
              value={
                member.zip && member.city
                  ? `${member.zip} ${member.city}`
                  : null
              }
            />
            <Row
              label="Geburtsdatum"
              value={member.birthdate?.toLocaleDateString("de-DE")}
            />
            <Row label="Telefon" value={member.phone} />
          </dl>
        </div>

        {/* Mitgliedschaft */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Mitgliedschaft
          </h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="Mitgliedstyp"
              value={
                member.membershipType
                  ? `${member.membershipType.name} (${eur.format(Number(member.membershipType.fee))})`
                  : null
              }
            />
            <Row
              label="Sparten"
              value={
                member.departments.length > 0
                  ? member.departments
                      .map(
                        (d) =>
                          `${d.department.name}${Number(d.department.extraFee) > 0 ? ` (+${eur.format(Number(d.department.extraFee))})` : ""}`,
                      )
                      .join(", ")
                  : null
              }
            />
            <Row label="Zahlungsintervall" value={member.paymentInterval} />
            <Row label="Zahlungsart" value={member.paymentMethod} />
            <Row
              label="Eintrittsdatum"
              value={member.entryDate?.toLocaleDateString("de-DE")}
            />
            <Row label="Mitgliedsnr." value={member.memberNo?.toString()} />
            <Row label="Notizen" value={member.notes} />
          </dl>
        </div>
      </div>

      {/* SEPA-Mandat */}
      {member.sepaMandate && (
        <div className="mt-6 bg-white rounded-lg border border-blue-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            SEPA-Lastschriftmandat
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Kontoinhaber" value={member.sepaMandate.accountHolder} />
            <Row label="IBAN" value={member.sepaMandate.iban} />
            <Row label="BIC" value={member.sepaMandate.bic} />
            <Row label="Mandatsreferenz" value={member.sepaMandate.mandateRef} />
            <Row label="Status" value={member.sepaMandate.status} />
          </dl>
        </div>
      )}

      {/* Zusatzoptionen */}
      {(member.photoConsent != null || member.newsletter != null || member.volunteer != null || member.donation != null || member.referredBy) && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Zusatzoptionen
          </h2>
          <dl className="space-y-2 text-sm">
            {member.photoConsent != null && <Row label="Fotoerlaubnis" value={member.photoConsent ? "Ja" : "Nein"} />}
            {member.newsletter != null && <Row label="Newsletter" value={member.newsletter ? "Ja" : "Nein"} />}
            {member.volunteer != null && <Row label="Ehrenamt" value={member.volunteer ? "Ja" : "Nein"} />}
            {member.donation != null && <Row label="Spende" value={`${Number(member.donation).toFixed(2)} EUR`} />}
            {member.referredBy && <Row label="Geworben von" value={member.referredBy} />}
          </dl>
        </div>
      )}

      {/* Erziehungsberechtigte */}
      {member.guardians.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border border-amber-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Erziehungsberechtigte
          </h2>
          {member.guardians.map((g) => (
            <dl key={g.id} className="space-y-2 text-sm">
              <Row label="Name" value={`${g.firstName} ${g.lastName}`} />
              <Row label="E-Mail" value={g.email} />
              <Row label="Telefon" value={g.phone} />
              <Row
                label="Anschrift"
                value={
                  g.street || g.zip || g.city
                    ? [g.street, [g.zip, g.city].filter(Boolean).join(" ")]
                        .filter(Boolean)
                        .join(", ")
                    : null
                }
              />
            </dl>
          ))}
        </div>
      )}

      {/* Status-Aktionen */}
      <div className="mt-6">
        <StatusActions memberId={member.id} currentStatus={member.status} />
      </div>

      {/* Status-History */}
      {history.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Verlauf
          </h2>
          <ol className="space-y-2">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${STATUS_COLORS[h.status]?.split(" ")[0] ?? "bg-gray-300"}`}
                />
                <span className="font-medium">{h.status}</span>
                <span className="text-gray-400">
                  {new Date(h.at).toLocaleString("de-DE")}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* QR-Code / Public-Link */}
      {slug && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Formular-Link
          </h2>
          <p className="text-sm text-gray-600">
            Teile diesen Link damit neue Mitglieder einen Antrag stellen
            koennen:
          </p>
          <p className="mt-2 text-sm font-mono bg-gray-50 px-3 py-2 rounded border">
            https://{slug}.fillqr.de
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 text-right">{value ?? "—"}</dd>
    </div>
  );
}
