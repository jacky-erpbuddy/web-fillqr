import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedDemoMembers } from './seed-demo.js';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenantApp = await prisma.tenantApp.findUnique({
    where: { slug: 'demo' },
    include: { app: true },
  });
  if (!tenantApp) { console.error('Demo-Tenant nicht gefunden'); process.exit(1); }

  const tenantId = tenantApp.tenantId;
  console.log(`Demo-Reset fuer Tenant ${tenantId}...`);

  // Member-Daten loeschen (FK-Reihenfolge)
  await prisma.sepaMandate.deleteMany({ where: { tenantId } });
  await prisma.guardian.deleteMany({ where: { member: { tenantId } } });
  await prisma.memberDepartment.deleteMany({ where: { member: { tenantId } } });
  await prisma.member.deleteMany({ where: { tenantId } });
  console.log('Alte Demo-Daten geloescht');

  // Types + Depts laden fuer Seed
  const types = new Map<string, string>();
  const depts = new Map<string, string>();
  for (const t of await prisma.membershipType.findMany({ where: { tenantId } })) types.set(t.name, t.id);
  for (const d of await prisma.department.findMany({ where: { tenantId } })) depts.set(d.name, d.id);

  await seedDemoMembers(prisma, tenantId, types, depts);
  console.log('Demo-Daten neu geseeded');
}

main()
  .then(() => { prisma.$disconnect(); process.exit(0); })
  .catch((err) => { console.error('Reset fehlgeschlagen:', err); prisma.$disconnect(); process.exit(1); });
