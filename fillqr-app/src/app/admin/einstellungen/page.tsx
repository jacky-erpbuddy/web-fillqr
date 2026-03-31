import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSettings } from "@/lib/settings-schema";
import SettingsEditor from "./SettingsEditor";

export default async function EinstellungenPage() {
  const user = await requireAuth();

  const [tenant, departments, membershipTypes, tenantApp] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        id: true,
        name: true,
        street: true,
        zip: true,
        city: true,
        email: true,
        phone: true,
        logoPath: true,
      },
    }),
    prisma.department.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
    }),
    prisma.membershipType.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
    }),
    prisma.tenantApp.findFirst({
      where: {
        tenantId: user.tenantId,
        app: { key: user.appKey },
      },
      select: { id: true, settingsJson: true },
    }),
  ]);

  if (!tenant || !tenantApp) {
    return (
      <div className="p-8 text-red-600">
        Fehler: Tenant oder Produkt nicht gefunden.
      </div>
    );
  }

  const settings = parseSettings(tenantApp.settingsJson);

  // Decimal → number fuer Client-Serialisierung
  const depts = departments.map((d) => ({
    ...d,
    extraFee: Number(d.extraFee),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));

  const types = membershipTypes.map((t) => ({
    ...t,
    fee: Number(t.fee),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Einstellungen</h1>
      <SettingsEditor
        tenant={tenant}
        departments={depts}
        membershipTypes={types}
        settings={settings}
      />
    </div>
  );
}
