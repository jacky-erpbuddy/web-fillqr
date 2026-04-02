import { headers } from "next/headers";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import BarChart from "@/components/charts/BarChart";
import LineChart from "@/components/charts/LineChart";

const STATUS_COLORS: Record<string, string> = {
  eingegangen: "bg-blue-100 text-blue-800",
  in_pruefung: "bg-yellow-100 text-yellow-800",
  angenommen: "bg-green-100 text-green-800",
  abgelehnt: "bg-red-100 text-red-800",
  gekuendigt: "bg-gray-100 text-gray-800",
};

export default async function DashboardPage() {
  const user = await requireAuth();
  const tenantId = user.tenantId;
  const headerList = await headers();
  const isDemo = headerList.get("x-tenant-slug") === "demo";

  const now = new Date();

  const [eingegangen, inPruefung, angenommen, gekuendigt, recent] = await Promise.all([
    prisma.member.count({ where: { tenantId, status: "eingegangen" } }),
    prisma.member.count({ where: { tenantId, status: "in_pruefung" } }),
    prisma.member.count({ where: { tenantId, status: "angenommen" } }),
    prisma.member.count({ where: { tenantId, status: "gekuendigt" } }),
    prisma.member.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, status: true, createdAt: true },
    }),
  ]);

  // Chart-Daten
  const months: { label: string; zugaenge: number; abgaenge: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const [zugaenge, abgaenge] = await Promise.all([
      prisma.member.count({ where: { tenantId, createdAt: { gte: d, lte: end }, status: { not: "abgelehnt" } } }),
      prisma.member.count({ where: { tenantId, exitDate: { gte: d, lte: end } } }),
    ]);
    months.push({ label, zugaenge, abgaenge });
  }

  const deptMembers = await prisma.memberDepartment.groupBy({
    by: ["departmentId"],
    where: { member: { tenantId, status: "angenommen" } },
    _count: true,
  });
  const depts = await prisma.department.findMany({
    where: { id: { in: deptMembers.map((d) => d.departmentId) } },
    select: { id: true, name: true },
  });
  const spartenData = deptMembers.map((d) => ({
    label: depts.find((dp) => dp.id === d.departmentId)?.name ?? "?",
    value: d._count,
  }));

  const typMembers = await prisma.member.groupBy({
    by: ["membershipTypeId"],
    where: { tenantId, status: "angenommen", membershipTypeId: { not: null } },
    _count: true,
  });
  const types = await prisma.membershipType.findMany({
    where: { id: { in: typMembers.map((t) => t.membershipTypeId!).filter(Boolean) } },
    select: { id: true, name: true },
  });
  const typData = typMembers.map((t) => ({
    label: types.find((tp) => tp.id === t.membershipTypeId)?.name ?? "?",
    value: t._count,
  }));

  const membersAge = await prisma.member.findMany({
    where: { tenantId, status: "angenommen", birthdate: { not: null } },
    select: { birthdate: true },
  });
  const ageGroups = { "0-17": 0, "18-30": 0, "31-50": 0, "51+": 0 };
  for (const m of membersAge) {
    if (!m.birthdate) continue;
    let age = now.getFullYear() - m.birthdate.getFullYear();
    const md = now.getMonth() - m.birthdate.getMonth();
    if (md < 0 || (md === 0 && now.getDate() < m.birthdate.getDate())) age--;
    if (age < 18) ageGroups["0-17"]++;
    else if (age <= 30) ageGroups["18-30"]++;
    else if (age <= 50) ageGroups["31-50"]++;
    else ageGroups["51+"]++;
  }
  const ageData = Object.entries(ageGroups).map(([label, value]) => ({ label, value }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <StatCard label="Neue Antraege" value={eingegangen} color="blue" />
        <StatCard label="Mitglieder" value={angenommen} color="green" />
        <StatCard label="In Pruefung" value={inPruefung} color="yellow" />
        <StatCard label="Gekuendigt" value={gekuendigt} color="gray" />
      </div>

      {/* Letzte Eingaenge */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">
            Letzte Eingaenge
          </h2>
        </div>
        {recent.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {recent.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/mitglieder/${m.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {m.firstName} {m.lastName}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {m.createdAt.toLocaleDateString("de-DE")}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] ?? "bg-gray-100 text-gray-800"}`}
                  >
                    {m.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">
            Noch keine Mitglieder.
          </p>
        )}
        <div className="px-4 py-2 border-t border-gray-100">
          <Link
            href="/admin/mitglieder"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Alle Mitglieder ansehen →
          </Link>
        </div>
      </div>

      {/* QR-Code Download (nur Demo) */}
      {isDemo && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">QR-Code fuer Demo-Formular</h2>
          <div className="flex items-center gap-6">
            <img src="/qr-demo.png" alt="QR-Code demo.fillqr.de" width={150} height={150} />
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Scanne den QR-Code um das Demo-Formular zu oeffnen.</p>
              <div className="flex gap-3">
                <a href="/qr-demo.png" download className="text-sm text-blue-600 hover:text-blue-800 underline">PNG herunterladen</a>
                <a href="/qr-demo.svg" download className="text-sm text-blue-600 hover:text-blue-800 underline">SVG herunterladen</a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts (AP-27) */}
      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Mitgliederentwicklung (12 Monate)</h2>
          <LineChart data={months} />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Verteilung nach Sparten</h2>
          <BarChart data={spartenData} color="#3b82f6" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Verteilung nach Mitgliedstyp</h2>
          <BarChart data={typData} color="#8b5cf6" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Altersstruktur</h2>
          <BarChart data={ageData} color="#f59e0b" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "yellow" | "gray";
}) {
  const colors = {
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    yellow: "border-yellow-200 bg-yellow-50",
    gray: "border-gray-200 bg-gray-50",
  };
  const textColors = {
    blue: "text-blue-700",
    green: "text-green-700",
    yellow: "text-yellow-700",
    gray: "text-gray-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${textColors[color]}`}>{value}</p>
    </div>
  );
}
