import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { extractSubdomain, isReserved } from "@/lib/tenant";

type TenantInfo = {
  tenant: {
    id: string;
    name: string;
    status: string;
  };
  appKey: string;
};

export async function getTenant(): Promise<TenantInfo | null> {
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");

  if (!slug) {
    return null;
  }

  const tenantApp = await prisma.tenantApp.findUnique({
    where: { slug },
    include: { tenant: true, app: true },
  });

  if (!tenantApp || !tenantApp.isEnabled) {
    return null;
  }

  if (tenantApp.tenant.status !== "active" && tenantApp.tenant.status !== "trial") {
    return null;
  }

  return {
    tenant: {
      id: tenantApp.tenant.id,
      name: tenantApp.tenant.name,
      status: tenantApp.tenant.status,
    },
    appKey: tenantApp.app.key,
  };
}

/**
 * Ermittelt den appKey fuer einen Login-Vorgang.
 * Subdomain aus Host → tenant_apps.slug → appKey.
 * Fallback (z.B. Login ueber app.fillqr.de): erste aktive App des Tenants.
 * V1-Workaround: In der Praxis loggen sich Kunden immer ueber ihre Subdomain ein.
 */
export async function resolveAppKeyForLogin(
  host: string,
  tenantId: string
): Promise<string | null> {
  const subdomain = extractSubdomain(host);

  // Subdomain vorhanden und nicht reserviert → direkt nachschlagen
  if (subdomain && !isReserved(subdomain)) {
    const tenantApp = await prisma.tenantApp.findUnique({
      where: { slug: subdomain },
      include: { app: true },
    });

    if (tenantApp && tenantApp.isEnabled && tenantApp.tenantId === tenantId) {
      return tenantApp.app.key;
    }
  }

  // Fallback: erste aktive App des Tenants (V1-Workaround, kommt kaum vor)
  const firstApp = await prisma.tenantApp.findFirst({
    where: { tenantId, isEnabled: true },
    include: { app: true },
    orderBy: { createdAt: "asc" },
  });

  return firstApp?.app.key ?? null;
}
