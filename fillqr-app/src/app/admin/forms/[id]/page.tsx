export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import QRCode from "qrcode";
import { createCaller } from "@/server/trpc/caller";
import { FORM_STATUS_TRANSITIONS } from "@/server/trpc/routers/form";
import { updateFormStatus } from "./actions";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Entwurf", color: "bg-gray-100 text-gray-600" },
  PUBLISHED: {
    label: "Veröffentlicht",
    color: "bg-green-100 text-green-800",
  },
  ARCHIVED: { label: "Archiviert", color: "bg-gray-100 text-gray-500" },
};

const TYPE_LABELS: Record<string, string> = {
  VEREIN: "Verein",
  FEEDBACK: "Feedback",
  LEAD: "Lead / Messe",
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: "Text",
  TEXTAREA: "Textfeld",
  EMAIL: "E-Mail",
  PHONE: "Telefon",
  SELECT: "Auswahl",
  CHECKBOX: "Checkbox",
  DATE: "Datum",
};

async function generateQrCode(url: string) {
  const png = await QRCode.toDataURL(url, { width: 512, margin: 2 });
  const svg = await QRCode.toString(url, { type: "svg", width: 512, margin: 2 });
  return { png, svg };
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function FormDetailPage({ params }: Props) {
  const { id } = await params;

  let form;
  try {
    const caller = await createCaller();
    form = await caller.form.getById({ id });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const currentStatus = form.status as keyof typeof FORM_STATUS_TRANSITIONS;
  const allowedNext = FORM_STATUS_TRANSITIONS[currentStatus] ?? [];
  const st = STATUS_LABELS[form.status] ?? STATUS_LABELS.DRAFT;

  // QR-Code generieren (nur bei PUBLISHED)
  let qr: { png: string; svg: string } | null = null;
  let qrError = false;
  const publicUrl = `${APP_URL}/f/${form.tenant.slug}/${form.slug}`;

  if (form.status === "PUBLISHED") {
    try {
      qr = await generateQrCode(publicUrl);
    } catch {
      qrError = true;
    }
  }

  const downloadBase = `fillqr-${form.tenant.slug}-${form.slug}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/forms"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Zurück
        </Link>
      </div>

      <h1 className="mt-4 text-2xl font-semibold text-gray-900">
        {form.title}
      </h1>

      {/* Metadaten */}
      <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
        <span>Typ: {TYPE_LABELS[form.type] ?? form.type}</span>
        <span>Slug: <code className="font-mono text-gray-700">{form.slug}</code></span>
        <span>Einsendungen: {form._count.submissions}</span>
        <span>
          Erstellt: {new Date(form.createdAt).toLocaleString("de-DE")}
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
            <form key={nextStatus} action={updateFormStatus}>
              <input type="hidden" name="formId" value={id} />
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

      {/* QR-Code Sektion */}
      {form.status === "PUBLISHED" ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-medium text-gray-900">QR-Code</h2>

          {qrError ? (
            <p className="mt-2 text-sm text-amber-600">
              QR-Code konnte nicht erzeugt werden.
            </p>
          ) : qr ? (
            <div className="mt-4 flex flex-col sm:flex-row gap-6">
              {/* QR Bild */}
              <div className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr.png}
                  alt={`QR-Code für ${form.title}`}
                  width={200}
                  height={200}
                  className="rounded border border-gray-100"
                />
              </div>

              {/* URL + Downloads */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500">Öffentlicher Link:</p>
                <code className="mt-1 block text-sm font-mono text-gray-900 break-all">
                  {publicUrl}
                </code>

                <div className="mt-4 flex gap-3">
                  <a
                    href={qr.png}
                    download={`${downloadBase}.png`}
                    className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    PNG herunterladen
                  </a>
                  <a
                    href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}`}
                    download={`${downloadBase}.svg`}
                    className="px-3 py-1.5 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    SVG herunterladen
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 rounded-md bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-500">
          Formular veröffentlichen, um einen QR-Code zu erhalten.
        </div>
      )}

      {/* Felder */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">
          Felder ({form.fields.length})
        </h2>

        {form.fields.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Keine Felder vorhanden.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-3 font-medium">#</th>
                  <th className="pb-3 font-medium">Bezeichnung</th>
                  <th className="pb-3 font-medium">Key</th>
                  <th className="pb-3 font-medium">Typ</th>
                  <th className="pb-3 font-medium">Pflicht</th>
                  <th className="pb-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {form.fields.map((field, idx) => {
                  const config = field.config as {
                    options?: string[];
                  } | null;
                  return (
                    <tr
                      key={field.id}
                      className="border-b border-gray-100"
                    >
                      <td className="py-3 text-gray-400">{idx + 1}</td>
                      <td className="py-3 text-gray-900">{field.label}</td>
                      <td className="py-3">
                        <code className="text-xs font-mono text-gray-600">
                          {field.key}
                        </code>
                      </td>
                      <td className="py-3 text-gray-600">
                        {FIELD_TYPE_LABELS[field.type] ?? field.type}
                      </td>
                      <td className="py-3">
                        {field.required ? (
                          <span className="text-green-600">Ja</span>
                        ) : (
                          <span className="text-gray-400">Nein</span>
                        )}
                      </td>
                      <td className="py-3 text-gray-500 text-xs">
                        {field.type === "SELECT" &&
                          config?.options &&
                          config.options.join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
