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

export type TenantResult =
  | { status: "ok"; tenant: TenantInfo["tenant"]; appKey: string }
  | { status: "not_found" }
  | { status: "inactive" };

export async function getTenant(): Promise<TenantResult | null> {
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");

  // Kein Slug = reservierte Subdomain oder direkte Domain → null (kein Fehler)
  if (!slug) {
    return null;
  }

  const tenantApp = await prisma.tenantApp.findUnique({
    where: { slug },
    include: { tenant: true, app: true },
  });

  if (!tenantApp) {
    return { status: "not_found" };
  }

  if (!tenantApp.isEnabled || (tenantApp.tenant.status !== "active" && tenantApp.tenant.status !== "trial")) {
    return { status: "inactive" };
  }

  return {
    status: "ok",
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
