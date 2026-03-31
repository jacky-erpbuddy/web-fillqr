import { prisma } from "@/lib/prisma";
import { getTenant } from "@/lib/get-tenant";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const result = await getTenant();
  const tenantName =
    result?.status === "ok" ? result.tenant.name : "dem Verein";

  // Member laden wenn ID vorhanden
  let summary: {
    name: string;
    type: string | null;
    departments: string[];
    interval: string | null;
  } | null = null;

  const tenantId = result?.status === "ok" ? result.tenant.id : null;

  if (params.id && tenantId) {
    const member = await prisma.member.findFirst({
      where: { id: params.id, tenantId },
      include: {
        membershipType: { select: { name: true } },
        departments: {
          include: { department: { select: { name: true } } },
        },
      },
    });

    if (member) {
      summary = {
        name: `${member.firstName} ${member.lastName}`,
        type: member.membershipType?.name ?? null,
        departments: member.departments.map((d) => d.department.name),
        interval: member.paymentInterval,
      };
    }
  }

  const intervallLabels: Record<string, string> = {
    monatlich: "Monatlich",
    vierteljaehrlich: "Vierteljaehrlich",
    halbjaehrlich: "Halbjaehrlich",
    jaehrlich: "Jaehrlich",
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="w-full max-w-lg mx-auto text-center">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-green-600 text-4xl mb-4">&#10003;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Vielen Dank!
          </h1>
          <p className="text-gray-600 mb-6">
            Dein Antrag ist beim <strong>{tenantName}</strong> eingegangen. Die
            Aufnahme erfolgt nach Pruefung durch den Vorstand.
          </p>

          {summary && (
            <div className="text-left bg-gray-50 rounded-md p-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Deine Angaben
              </h2>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Name:</dt>
                  <dd className="text-gray-900">{summary.name}</dd>
                </div>
                {summary.type && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Mitgliedstyp:</dt>
                    <dd className="text-gray-900">{summary.type}</dd>
                  </div>
                )}
                {summary.departments.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Sparten:</dt>
                    <dd className="text-gray-900">
                      {summary.departments.join(", ")}
                    </dd>
                  </div>
                )}
                {summary.interval && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Zahlung:</dt>
                    <dd className="text-gray-900">
                      {intervallLabels[summary.interval] ?? summary.interval}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          <p className="text-sm text-gray-500">
            Du erhaeltst eine Bestaetigung per E-Mail.
          </p>
        </div>
      </div>
    </main>
  );
}
