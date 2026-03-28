export const dynamic = "force-dynamic";

import Link from "next/link";
import { createCaller } from "@/server/trpc/caller";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Entwurf", color: "bg-gray-100 text-gray-600" },
  PUBLISHED: { label: "Veröffentlicht", color: "bg-green-100 text-green-800" },
  ARCHIVED: { label: "Archiviert", color: "bg-gray-100 text-gray-500" },
};

const TYPE_LABELS: Record<string, string> = {
  VEREIN: "Verein",
  FEEDBACK: "Feedback",
  LEAD: "Lead / Messe",
};

export default async function FormsPage() {
  const caller = await createCaller();
  const forms = await caller.form.list();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Formulare</h1>
        <Link
          href="/admin/forms/new"
          className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
        >
          Neues Formular
        </Link>
      </div>

      {forms.length === 0 ? (
        <p className="mt-8 text-gray-500">
          Noch keine Formulare vorhanden.{" "}
          <Link href="/admin/forms/new" className="text-blue-600 hover:text-blue-800">
            Jetzt erstellen
          </Link>
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-3 font-medium">Titel</th>
                <th className="pb-3 font-medium">Typ</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Felder</th>
                <th className="pb-3 font-medium">Einsendungen</th>
                <th className="pb-3 font-medium">Erstellt</th>
                <th className="pb-3 font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form) => {
                const st = STATUS_LABELS[form.status] ?? STATUS_LABELS.DRAFT;
                return (
                  <tr
                    key={form.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-3 text-gray-900 font-medium">
                      {form.title}
                    </td>
                    <td className="py-3 text-gray-600">
                      {TYPE_LABELS[form.type] ?? form.type}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${st.color}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">{form._count.fields}</td>
                    <td className="py-3 text-gray-600">
                      {form._count.submissions}
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(form.createdAt).toLocaleDateString("de-DE")}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/forms/${form.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Bearbeiten
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
