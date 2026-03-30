import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  const tenants = await prisma.tenant.findMany({
    select: { status: true, name: true },
  });
  console.log("Tenants:", JSON.stringify(tenants));

  const apps = await prisma.app.findMany({
    select: { key: true, name: true },
  });
  console.log("Apps:", JSON.stringify(apps));

  const tenantApps = await prisma.tenantApp.findMany({
    select: { slug: true, isEnabled: true, tenantId: true, appId: true },
  });
  console.log("TenantApps:", JSON.stringify(tenantApps));

  process.exit(0);
}

main();
