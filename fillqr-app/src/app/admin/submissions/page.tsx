export const dynamic = "force-dynamic";

import Link from "next/link";
import { createCaller } from "@/server/trpc/caller";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: "Neu", color: "bg-blue-100 text-blue-800" },
  IN_REVIEW: { label: "In Bearbeitung", color: "bg-yellow-100 text-yellow-800" },
  DONE: { label: "Erledigt", color: "bg-green-100 text-green-800" },
  ARCHIVED: { label: "Archiviert", color: "bg-gray-100 text-gray-600" },
};

const FILTER_OPTIONS = [
  { value: undefined, label: "Alle" },
  { value: "NEW", label: "Neu" },
  { value: "IN_REVIEW", label: "In Bearbeitung" },
  { value: "DONE", label: "Erledigt" },
  { value: "ARCHIVED", label: "Archiviert" },
] as const;

type Props = {
  searchParams: Promise<{ status?: string; cursor?: string }>;
};

export default async function SubmissionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = params.status as
    | "NEW"
    | "IN_REVIEW"
    | "DONE"
    | "ARCHIVED"
    | undefined;

  const caller = await createCaller();
  const { items, nextCursor } = await caller.submission.list({
    status: statusFilter,
    cursor: params.cursor,
    limit: 20,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Einsendungen</h1>

      {/* Status-Filter */}
      <div className="mt-4 flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = statusFilter === opt.value;
          const href = opt.value
            ? `/admin/submissions?status=${opt.value}`
            : "/admin/submissions";
          return (
            <Link
              key={opt.label}
              href={href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                isActive
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* Tabelle oder leerer State */}
      {items.length === 0 ? (
        <p className="mt-8 text-gray-500">Keine Einsendungen gefunden.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Formular</th>
                <th className="pb-3 font-medium">Eingang</th>
                <th className="pb-3 font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const st = STATUS_LABELS[item.status] ?? STATUS_LABELS.NEW;
                return (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${st.color}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3 text-gray-900">{item.form.title}</td>
                    <td className="py-3 text-gray-500">
                      {new Date(item.createdAt).toLocaleString("de-DE")}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/submissions/${item.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Ansehen
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {nextCursor && (
        <div className="mt-4">
          <Link
            href={`/admin/submissions?cursor=${nextCursor}${statusFilter ? `&status=${statusFilter}` : ""}`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Nächste Seite →
          </Link>
        </div>
      )}
    </div>
  );
}
