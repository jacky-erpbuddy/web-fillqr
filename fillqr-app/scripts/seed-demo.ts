import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

// ============================================================
// Exportierte Funktion fuer reset-demo.ts
// ============================================================

export async function seedDemoMembers(
  prisma: PrismaClient,
  tenantId: string,
  types: Map<string, string>,
  depts: Map<string, string>,
) {
  const entryDate = new Date('2026-01-01');
  const defaultBirthdate = new Date('1985-01-15');

  // Helper
  const email = (first: string, last: string) =>
    `${first.toLowerCase()}.${last.toLowerCase()}@example.de`;
  const phone = (n: number) => `0711 ${String(n).padStart(7, '0')}`;

  // --- Member 1: Max Mustermann ---
  const m1 = await prisma.member.create({
    data: {
      tenantId,
      memberNo: 1,
      status: 'angenommen',
      firstName: 'Max',
      lastName: 'Mustermann',
      email: email('max', 'mustermann'),
      phone: phone(1234001),
      street: 'Musterstr. 1',
      zip: '73728',
      city: 'Esslingen',
      birthdate: defaultBirthdate,
      entryDate,
      membershipTypeId: types.get('Aktiv Erwachsene')!,
      paymentInterval: 'monatlich',
      paymentMethod: 'sepa',
      photoConsent: true,
      newsletter: true,
    },
  });
  await prisma.sepaMandate.create({
    data: {
      memberId: m1.id,
      tenantId,
      accountHolder: 'Max Mustermann',
      iban: 'DE89370400440532013000',
      mandateRef: 'FILLQR-DEMO-1',
    },
  });
  await prisma.memberDepartment.create({
    data: { memberId: m1.id, departmentId: depts.get('Fussball')! },
  });

  // --- Member 2: Lisa Mueller ---
  const m2 = await prisma.member.create({
    data: {
      tenantId,
      memberNo: 2,
      status: 'angenommen',
      firstName: 'Lisa',
      lastName: 'Mueller',
      email: email('lisa', 'mueller'),
      phone: phone(1234002),
      street: 'Musterstr. 2',
      zip: '73728',
      city: 'Esslingen',
      birthdate: defaultBirthdate,
      entryDate,
      membershipTypeId: types.get('Aktiv Erwachsene')!,
      paymentInterval: 'monatlich',
      paymentMethod: 'ueberweisung',
      photoConsent: true,
      newsletter: true,
    },
  });
  await prisma.memberDepartment.createMany({
    data: [
      { memberId: m2.id, departmentId: depts.get('Schwimmen')! },
      { memberId: m2.id, departmentId: depts.get('Turnen')! },
    ],
  });

  // --- Member 3: Tim Weber (Jugend, Guardian, SEPA) ---
  const m3 = await prisma.member.create({
    data: {
      tenantId,
      memberNo: 3,
      status: 'angenommen',
      firstName: 'Tim',
      lastName: 'Weber',
      email: email('tim', 'weber'),
      phone: phone(1234003),
      street: 'Musterstr. 3',
      zip: '73728',
      city: 'Esslingen',
      birthdate: new Date('2012-05-15'),
      entryDate,
      membershipTypeId: types.get('Aktiv Jugend')!,
      paymentInterval: 'monatlich',
      paymentMethod: 'sepa',
      photoConsent: true,
      newsletter: true,
    },
  });
  await prisma.guardian.create({
    data: {
      memberId: m3.id,
      firstName: 'Sabine',
      lastName: 'Weber',
      email: 'sabine.weber@example.de',
      phone: '0711 9876543',
      relation: 'Mutter',
    },
  });
  await prisma.sepaMandate.create({
    data: {
      memberId: m3.id,
      tenantId,
      accountHolder: 'Sabine Weber',
      iban: 'DE89370400440532013000',
      mandateRef: 'FILLQR-DEMO-2',
    },
  });
  await prisma.memberDepartment.create({
    data: { memberId: m3.id, departmentId: depts.get('Leichtathletik')! },
  });

  // --- Member 4: Klaus Schmidt (Familie, familyHead) ---
  const m4 = await prisma.member.create({
    data: {
      tenantId,
      memberNo: 4,
      status: 'angenommen',
      firstName: 'Klaus',
      lastName: 'Schmidt',
      email: email('klaus', 'schmidt'),
      phone: phone(1234004),
      street: 'Musterstr. 4',
      zip: '73728',
      city: 'Esslingen',
      birthdate: defaultBirthdate,
      entryDate,
      membershipTypeId: types.get('Familie')!,
      paymentInterval: 'monatlich',
      paymentMethod: 'sepa',
      photoConsent: true,
      newsletter: true,
      familyHead: true,
    },
  });
  // familyGroupId auf eigene ID setzen
  await prisma.member.update({
    where: { id: m4.id },
    data: { familyGroupId: m4.id },
  });
  await prisma.sepaMandate.create({
    data: {
      memberId: m4.id,
      tenantId,
      accountHolder: 'Klaus Schmidt',
      iban: 'DE89370400440532013000',
      mandateRef: 'FILLQR-DEMO-3',
    },
  });
  await prisma.memberDepartment.create({
    data: { memberId: m4.id, departmentId: depts.get('Fussball')! },
  });

  // --- Member 4b: Maria Schmidt (Familie, familyGroupId=Klaus) ---
  const m4b = await prisma.member.create({
    data: {
      tenantId,
      memberNo: 5,
      status: 'angenommen',
      firstName: 'Maria',
      lastName: 'Schmidt',
      email: email('klaus', 'schmidt'), // gleiche Email wie Klaus
      phone: phone(1234004),
      street: 'Musterstr. 4',
      zip: '73728',
      city: 'Esslingen',
      birthdate: defaultBirthdate,
      entryDate,
      membershipTypeId: types.get('Familie')!,
      paymentInterval: 'monatlich',
      photoConsent: true,
      newsletter: true,
      familyHead: false,
      familyGroupId: m4.id,
    },
  });
  await prisma.memberDepartment.create({
    data: { memberId: m4b.id, departmentId: depts.get('Fussball')! },
  });

  // --- Member 4c: Lena Schmidt (Familie, minderjaehrig, Guardian) ---
  const m4c = await prisma.member.create({
    data: {
      tenantId,
      memberNo: 6,
      status: 'angenommen',
      firstName: 'Lena',
      lastName: 'Schmidt',
      email: email('klaus', 'schmidt'), // gleiche Email wie Klaus
      phone: phone(1234004),
      street: 'Musterstr. 4',
      zip: '73728',
      city: 'Esslingen',
      birthdate: new Date('2013-03-22'),
      entryDate,
      membershipTypeId: types.get('Familie')!,
      paymentInterval: 'monatlich',
      photoConsent: true,
      newsletter: true,
      familyHead: false,
      familyGroupId: m4.id,
    },
  });
  await prisma.guardian.create({
    data: {
      memberId: m4c.id,
      firstName: 'Klaus',
      lastName: 'Schmidt',
      email: 'klaus.schmidt@example.de',
      relation: 'Vater',
    },
  });
  await prisma.memberDepartment.create({
    data: { memberId: m4c.id, departmentId: depts.get('Fussball')! },
  });

  // --- Member 5: Anna Becker (Passiv, kein Department) ---
  await prisma.member.create({
    data: {
      tenantId,
      memberNo: 7,
      status: 'angenommen',
      firstName: 'Anna',
      lastName: 'Becker',
      email: email('anna', 'becker'),
      phone: phone(1234005),
      street: 'Musterstr. 5',
      zip: '73728',
      city: 'Esslingen',
      birthdate: defaultBirthdate,
      entryDate,
      membershipTypeId: types.get('Passiv')!,
      paymentInterval: 'monatlich',
      paymentMethod: 'ueberweisung',
      photoConsent: true,
      newsletter: true,
    },
  });

  // --- Member 6: Peter Hoffmann (eingegangen, kein memberNo) ---
  const m6 = await prisma.member.create({
    data: {
      tenantId,
      status: 'eingegangen',
      firstName: 'Peter',
      lastName: 'Hoffmann',
      email: email('peter', 'hoffmann'),
      phone: phone(1234006),
      street: 'Musterstr. 6',
      zip: '73728',
      city: 'Esslingen',
      birthdate: defaultBirthdate,
      entryDate,
      membershipTypeId: types.get('Aktiv Erwachsene')!,
      paymentInterval: 'monatlich',
      paymentMethod: 'sepa',
      photoConsent: true,
      newsletter: false,
    },
  });
  await prisma.sepaMandate.create({
    data: {
      memberId: m6.id,
      tenantId,
      accountHolder: 'Peter Hoffmann',
      iban: 'DE89370400440532013000',
      mandateRef: 'FILLQR-DEMO-4',
    },
  });
  await prisma.memberDepartment.create({
    data: { memberId: m6.id, departmentId: depts.get('Fussball')! },
  });

  // --- Member 7: Sandra Klein (in_pruefung, kein memberNo) ---
  const m7 = await prisma.member.create({
    data: {
      tenantId,
      status: 'in_pruefung',
      firstName: 'Sandra',
      lastName: 'Klein',
      email: email('sandra', 'klein'),
      phone: phone(1234007),
      street: 'Musterstr. 7',
      zip: '73728',
      city: 'Esslingen',
      birthdate: defaultBirthdate,
      entryDate,
      membershipTypeId: types.get('Aktiv Erwachsene')!,
      paymentInterval: 'monatlich',
      photoConsent: true,
      newsletter: false,
    },
  });
  await prisma.memberDepartment.create({
    data: { memberId: m7.id, departmentId: depts.get('Schwimmen')! },
  });

  // --- Member 8: Juergen Wolf (abgelehnt, kein memberNo) ---
  const m8 = await prisma.member.create({
    data: {
      tenantId,
      status: 'abgelehnt',
      firstName: 'Juergen',
      lastName: 'Wolf',
      email: email('juergen', 'wolf'),
      phone: phone(1234008),
      street: 'Musterstr. 8',
      zip: '73728',
      city: 'Esslingen',
      birthdate: defaultBirthdate,
      entryDate,
      membershipTypeId: types.get('Aktiv Erwachsene')!,
      paymentInterval: 'monatlich',
      photoConsent: true,
      newsletter: false,
    },
  });
  await prisma.memberDepartment.create({
    data: { memberId: m8.id, departmentId: depts.get('Turnen')! },
  });

  console.log('  8 Members + Guardians + SEPA + Departments erstellt');
}

// ============================================================
// Main
// ============================================================

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  console.log('=== fillQR Demo-Seed ===\n');

  // --------------------------------------------------------
  // 1. Cleanup (idempotent)
  // --------------------------------------------------------
  console.log('1. Cleanup...');
  const existingTenantApp = await prisma.tenantApp.findUnique({
    where: { slug: 'demo' },
  });

  if (existingTenantApp) {
    const tid = existingTenantApp.tenantId;
    console.log(`  Bestehender Demo-Tenant gefunden (${tid}), loesche...`);

    // FK-Reihenfolge: tiefste Abhaengigkeiten zuerst
    await prisma.memberDepartment.deleteMany({ where: { member: { tenantId: tid } } });
    await prisma.guardian.deleteMany({ where: { member: { tenantId: tid } } });
    await prisma.sepaMandate.deleteMany({ where: { tenantId: tid } });
    await prisma.member.deleteMany({ where: { tenantId: tid } });
    await prisma.emailTemplate.deleteMany({ where: { tenantId: tid } });
    await prisma.membershipType.deleteMany({ where: { tenantId: tid } });
    await prisma.department.deleteMany({ where: { tenantId: tid } });
    await prisma.appUser.deleteMany({ where: { tenantId: tid } });
    await prisma.tenantApp.delete({ where: { slug: 'demo' } });
    await prisma.tenant.delete({ where: { id: tid } });

    console.log('  Cleanup abgeschlossen');
  } else {
    console.log('  Kein bestehender Demo-Tenant gefunden');
  }

  // --------------------------------------------------------
  // 2. Tenant
  // --------------------------------------------------------
  console.log('\n2. Tenant erstellen...');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'TSV Musterstadt e.V.',
      street: 'Sportplatzweg 12',
      zip: '73728',
      city: 'Esslingen am Neckar',
      email: 'info@tsv-musterstadt.de',
      phone: '0711 1234567',
      status: 'active',
    },
  });
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);

  // --------------------------------------------------------
  // 3. App finden + TenantApp
  // --------------------------------------------------------
  console.log('\n3. TenantApp erstellen...');
  const vereinsbuddy = await prisma.app.findUnique({ where: { key: 'vereinsbuddy' } });
  if (!vereinsbuddy) {
    throw new Error('App "vereinsbuddy" nicht gefunden! Bitte erst DB-Migration ausfuehren.');
  }

  const tenantApp = await prisma.tenantApp.create({
    data: {
      tenantId: tenant.id,
      appId: vereinsbuddy.id,
      slug: 'demo',
      isEnabled: true,
      settingsJson: {
        sepa_aktiv: true,
        sepa_glaeubiger_id: 'DE98ZZZ09999999999',
        sepa_pre_notification: 14,
        aufnahmegebuehr: 20,
        familienmitgliedschaft: true,
        zahlungsintervalle: ['monatlich', 'vierteljaehrlich', 'halbjaehrlich', 'jaehrlich'],
        zahlungsarten: { ueberweisung: true, bar: false },
        optionale_felder: {
          telefon: true,
          fotoerlaubnis: true,
          newsletter: true,
          ehrenamt: true,
          spende: true,
          mitglied_wirbt: true,
        },
        foto_upload: 'optional',
        satzung_url: null,
        beitragsordnung_url: null,
        impressum: {
          name: 'TSV Musterstadt e.V.',
          street: 'Sportplatzweg 12',
          zip: '73728',
          city: 'Esslingen am Neckar',
        },
      },
    },
  });
  console.log(`  TenantApp: slug="${tenantApp.slug}" (${tenantApp.id})`);

  // --------------------------------------------------------
  // 4. AppUser (Demo-Admin)
  // --------------------------------------------------------
  console.log('\n4. AppUser erstellen...');
  const appUser = await prisma.appUser.create({
    data: {
      tenantId: tenant.id,
      email: 'demo@fillqr.de',
      passwordHash: bcrypt.hashSync('demo2026', 10),
    },
  });
  console.log(`  AppUser: ${appUser.email} (${appUser.id})`);

  // --------------------------------------------------------
  // 5. MembershipTypes
  // --------------------------------------------------------
  console.log('\n5. MembershipTypes erstellen...');
  const typeData = [
    { name: 'Aktiv Erwachsene', fee: 15.0 },
    { name: 'Aktiv Jugend', fee: 8.0 },
    { name: 'Passiv', fee: 5.0 },
    { name: 'Familie', fee: 25.0 },
  ];

  const types = new Map<string, string>();
  for (const t of typeData) {
    const created = await prisma.membershipType.create({
      data: { tenantId: tenant.id, name: t.name, fee: t.fee, isActive: true },
    });
    types.set(t.name, created.id);
    console.log(`  ${t.name}: ${t.fee} EUR (${created.id})`);
  }

  // --------------------------------------------------------
  // 6. Departments
  // --------------------------------------------------------
  console.log('\n6. Departments erstellen...');
  const deptData = ['Fussball', 'Schwimmen', 'Turnen', 'Leichtathletik'];

  const depts = new Map<string, string>();
  for (const name of deptData) {
    const created = await prisma.department.create({
      data: { tenantId: tenant.id, name, extraFee: 0, isActive: true },
    });
    depts.set(name, created.id);
    console.log(`  ${name} (${created.id})`);
  }

  // --------------------------------------------------------
  // 7. Members
  // --------------------------------------------------------
  console.log('\n7. Members erstellen...');
  await seedDemoMembers(prisma, tenant.id, types, depts);

  // --------------------------------------------------------
  // Zusammenfassung
  // --------------------------------------------------------
  const memberCount = await prisma.member.count({ where: { tenantId: tenant.id } });
  const sepaCount = await prisma.sepaMandate.count({ where: { tenantId: tenant.id } });
  const guardianCount = await prisma.guardian.count({ where: { member: { tenantId: tenant.id } } });

  console.log('\n=== Zusammenfassung ===');
  console.log(`  Tenant:          ${tenant.name}`);
  console.log(`  TenantApp:       slug="demo"`);
  console.log(`  AppUser:         demo@fillqr.de / demo2026`);
  console.log(`  MembershipTypes: ${types.size}`);
  console.log(`  Departments:     ${depts.size}`);
  console.log(`  Members:         ${memberCount}`);
  console.log(`  SEPA-Mandate:    ${sepaCount}`);
  console.log(`  Guardians:       ${guardianCount}`);
  console.log('\nDemo-Seed abgeschlossen!');
}

// Nur bei direkter Ausfuehrung (nicht bei Import durch reset-demo.ts)
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('seed-demo.ts')
  || process.argv[1]?.replace(/\\/g, '/').endsWith('seed-demo.js');

if (isDirectRun) {
  main()
    .catch(console.error)
    .finally(() => process.exit(0));
}
