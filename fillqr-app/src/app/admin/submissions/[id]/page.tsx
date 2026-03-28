export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { createCaller } from "@/server/trpc/caller";
import { ALLOWED_TRANSITIONS } from "@/server/trpc/routers/submission";
import { updateSubmissionStatus } from "./actions";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  NEW: { label: "Neu", color: "bg-blue-100 text-blue-800" },
  IN_REVIEW: { label: "In Bearbeitung", color: "bg-yellow-100 text-yellow-800" },
  DONE: { label: "Erledigt", color: "bg-green-100 text-green-800" },
  ARCHIVED: { label: "Archiviert", color: "bg-gray-100 text-gray-600" },
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SubmissionDetailPage({ params }: Props) {
  const { id } = await params;

  let submission;
  try {
    const caller = await createCaller();
    submission = await caller.submission.getById({ id });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const payload = submission.payload as Record<string, unknown>;
  const currentStatus = submission.status as keyof typeof ALLOWED_TRANSITIONS;
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  const st = STATUS_LABELS[submission.status] ?? STATUS_LABELS.NEW;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/submissions"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Zurück
        </Link>
      </div>

      <h1 className="mt-4 text-2xl font-semibold text-gray-900">
        {submission.form.title}
      </h1>

      {/* Metadaten */}
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
        <span>Typ: {submission.form.type}</span>
        <span>
          Eingang: {new Date(submission.createdAt).toLocaleString("de-DE")}
        </span>
        <span>
          Letzte Änderung:{" "}
          {new Date(submission.updatedAt).toLocaleString("de-DE")}
        </span>
      </div>

      {/* Status + Aktionen */}
      <div className="mt-6 flex items-center gap-4 flex-wrap">
        <span
          className={`inline-block px-3 py-1 rounded text-sm font-medium ${st.color}`}
        >
          {st.label}
        </span>

        {allowedNext.map((nextStatus) => {
          const label = STATUS_LABELS[nextStatus]?.label ?? nextStatus;
          return (
            <form key={nextStatus} action={updateSubmissionStatus}>
              <input type="hidden" name="submissionId" value={id} />
              <input type="hidden" name="status" value={nextStatus} />
              <button
                type="submit"
                className="px-3 py-1 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
              >
                → {label}
              </button>
            </form>
          );
        })}
      </div>

      {/* Payload */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Einsendungsdaten</h2>
        <dl className="mt-4 divide-y divide-gray-100">
          {submission.form.fields.map((field) => {
            const value = payload[field.key];
            return (
              <div key={field.key} className="py-3 flex gap-4">
                <dt className="w-40 shrink-0 text-sm font-medium text-gray-500">
                  {field.label}
                </dt>
                <dd className="text-sm text-gray-900">
                  {formatFieldValue(value, field.type)}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}

function formatFieldValue(value: unknown, type: string): string {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (type === "CHECKBOX") {
    return value === true ? "Ja" : "Nein";
  }
  if (type === "DATE" && typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("de-DE");
  }
  return String(value);
}
