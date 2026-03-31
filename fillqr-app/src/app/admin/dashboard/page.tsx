import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

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

  const [eingegangen, inPruefung, angenommen, recent] = await Promise.all([
    prisma.member.count({ where: { tenantId, status: "eingegangen" } }),
    prisma.member.count({ where: { tenantId, status: "in_pruefung" } }),
    prisma.member.count({ where: { tenantId, status: "angenommen" } }),
    prisma.member.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <StatCard label="Neue Antraege" value={eingegangen} color="blue" />
        <StatCard label="Mitglieder" value={angenommen} color="green" />
        <StatCard label="In Pruefung" value={inPruefung} color="yellow" />
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
  color: "blue" | "green" | "yellow";
}) {
  const colors = {
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    yellow: "border-yellow-200 bg-yellow-50",
  };
  const textColors = {
    blue: "text-blue-700",
    green: "text-green-700",
    yellow: "text-yellow-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${textColors[color]}`}>{value}</p>
    </div>
  );
}
