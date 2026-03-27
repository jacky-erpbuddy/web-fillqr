import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getTenant() {
  const headerList = await headers();
  const slug = headerList.get("x-tenant-slug");

  if (!slug) {
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
  });

  if (!tenant || (tenant.status !== "ACTIVE" && tenant.status !== "TRIAL")) {
    return null;
  }

  return tenant;
}
