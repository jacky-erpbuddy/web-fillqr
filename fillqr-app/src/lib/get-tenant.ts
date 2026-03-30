import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getTenant() {
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");

  if (!slug) {
    return null;
  }

  const tenantApp = await prisma.tenantApp.findUnique({
    where: { slug },
    include: { tenant: true },
  });

  if (!tenantApp || (tenantApp.tenant.status !== "active" && tenantApp.tenant.status !== "trial")) {
    return null;
  }

  return tenantApp.tenant;
}
