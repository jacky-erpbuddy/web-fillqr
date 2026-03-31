import { getTenant } from "@/lib/get-tenant";
import { prisma } from "@/lib/prisma";
import { parseSettings } from "@/lib/settings-schema";
import ErrorLayout from "@/components/error-layout";
import MembershipForm from "@/app/vereinsbuddy/MembershipForm";

export default async function Home() {
  const result = await getTenant();

  // Kein Tenant-Slug (reservierte Subdomain oder direkte Domain)
  if (!result) {
    return (
      <main>
        <h1>fillQR</h1>
        <p>Fullstack-App wird eingerichtet.</p>
      </main>
    );
  }

  if (result.status === "not_found") {
    return (
      <ErrorLayout
        title="Diese Seite ist nicht verfügbar"
        message="Die aufgerufene Adresse ist nicht registriert. Prüfe die URL oder besuche unsere Startseite."
      />
    );
  }

  if (result.status === "inactive") {
    return (
      <ErrorLayout
        title="Diese Seite ist derzeit nicht aktiv"
        message="Der Zugang zu dieser Seite wurde vorübergehend deaktiviert. Bei Fragen wende dich an den Betreiber."
      />
    );
  }

  // status === "ok" — Tenant ist aktiv, Switch auf appKey
  const { tenant, appKey } = result;

  if (appKey === "vereinsbuddy") {
    const [tenantFull, membershipTypes, departments, tenantApp] =
      await Promise.all([
        prisma.tenant.findUnique({
          where: { id: tenant.id },
          select: { street: true, zip: true, city: true },
        }),
        prisma.membershipType.findMany({
          where: { tenantId: tenant.id, isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.department.findMany({
          where: { tenantId: tenant.id, isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.tenantApp.findFirst({
          where: { tenantId: tenant.id, app: { key: "vereinsbuddy" } },
          select: { settingsJson: true },
        }),
      ]);

    const settings = parseSettings(tenantApp?.settingsJson);

    return (
      <MembershipForm
        tenantName={tenant.name}
        tenantStreet={tenantFull?.street ?? ""}
        tenantZip={tenantFull?.zip ?? ""}
        tenantCity={tenantFull?.city ?? ""}
        membershipTypes={membershipTypes.map((t) => ({
          id: t.id,
          name: t.name,
          fee: Number(t.fee),
        }))}
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          extraFee: Number(d.extraFee),
        }))}
        settings={{
          zahlungsintervalle: settings.zahlungsintervalle,
          telefonSichtbar: settings.optionale_felder.telefon,
          aufnahmegebuehr: settings.aufnahmegebuehr,
          satzungUrl: settings.satzung_url,
          beitragsordnungUrl: settings.beitragsordnung_url,
          impressum: settings.impressum,
        }}
      />
    );
  }

  // trainerfeedback, messebuddy — Coming soon
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {tenant.name}
        </h1>
        <p className="text-gray-500">Coming soon</p>
      </div>
    </main>
  );
}
