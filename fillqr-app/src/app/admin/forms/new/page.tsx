"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FieldInput = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  sortOrder: number;
  options: string; // comma-separated for SELECT
};

const FIELD_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTAREA", label: "Textfeld (mehrzeilig)" },
  { value: "EMAIL", label: "E-Mail" },
  { value: "PHONE", label: "Telefon" },
  { value: "SELECT", label: "Auswahl" },
  { value: "CHECKBOX", label: "Checkbox" },
  { value: "DATE", label: "Datum" },
];

const FORM_TYPES = [
  { value: "VEREIN", label: "Verein" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "LEAD", label: "Lead / Messe" },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function generateKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

export default function NewFormPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [formType, setFormType] = useState("VEREIN");
  const [fields, setFields] = useState<FieldInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugManual) {
      setSlug(generateSlug(val));
    }
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      {
        key: "",
        label: "",
        type: "TEXT",
        required: false,
        sortOrder: prev.length,
        options: "",
      },
    ]);
  }

  function updateField(index: number, updates: Partial<FieldInput>) {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...updates };
        // Auto-generate key from label if key is empty or was auto-generated
        if ("label" in updates && (f.key === "" || f.key === generateKey(f.label))) {
          updated.key = generateKey(updates.label ?? "");
        }
        return updated;
      })
    );
  }

  function removeField(index: number) {
    setFields((prev) =>
      prev.filter((_, i) => i !== index).map((f, i) => ({ ...f, sortOrder: i }))
    );
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((f, i) => ({ ...f, sortOrder: i }));
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const body = {
        json: {
          title,
          slug,
          type: formType,
          fields: fields.map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            sortOrder: f.sortOrder,
            config: f.type === "SELECT"
              ? { options: f.options.split(",").map((o) => o.trim()).filter(Boolean) }
              : null,
          })),
        },
      };

      const res = await fetch("/api/trpc/form.create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          data?.error?.json?.message ??
          data?.error?.message ??
          "Fehler beim Erstellen";
        setError(msg);
        return;
      }

      const formId = data?.result?.data?.json?.id;
      router.push(formId ? `/admin/forms/${formId}` : "/admin/forms");
      router.refresh();
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900">
        Neues Formular erstellen
      </h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Titel */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Titel *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="z.B. Mitgliedsantrag"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            URL-Slug *
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManual(true);
            }}
            required
            pattern="[a-z0-9\-]+"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            Nur Kleinbuchstaben, Zahlen und Bindestriche
          </p>
        </div>

        {/* Typ */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Typ *
          </label>
          <select
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {FORM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Felder */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Felder
            </label>
            <button
              type="button"
              onClick={addField}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              + Feld hinzufügen
            </button>
          </div>

          {fields.length === 0 && (
            <p className="mt-2 text-sm text-gray-400">
              Noch keine Felder. Klicke &quot;+ Feld hinzufügen&quot;.
            </p>
          )}

          <div className="mt-3 space-y-4">
            {fields.map((field, idx) => (
              <div
                key={idx}
                className="rounded-md border border-gray-200 bg-white p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-400">
                    Feld {idx + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveField(idx, -1)}
                      disabled={idx === 0}
                      className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(idx, 1)}
                      disabled={idx === fields.length - 1}
                      className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(idx)}
                      className="px-2 py-0.5 text-xs text-red-500 hover:text-red-700"
                    >
                      Entfernen
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Label */}
                  <div>
                    <label className="block text-xs text-gray-500">
                      Bezeichnung *
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) =>
                        updateField(idx, { label: e.target.value })
                      }
                      required
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="z.B. Vorname"
                    />
                  </div>

                  {/* Key */}
                  <div>
                    <label className="block text-xs text-gray-500">
                      Key *
                    </label>
                    <input
                      type="text"
                      value={field.key}
                      onChange={(e) =>
                        updateField(idx, { key: e.target.value })
                      }
                      required
                      pattern="[a-z0-9_]+"
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
                      placeholder="vorname"
                    />
                  </div>

                  {/* Typ */}
                  <div>
                    <label className="block text-xs text-gray-500">Typ</label>
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateField(idx, { type: e.target.value })
                      }
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Required */}
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) =>
                          updateField(idx, { required: e.target.checked })
                        }
                        className="rounded border-gray-300"
                      />
                      Pflichtfeld
                    </label>
                  </div>
                </div>

                {/* SELECT: Options */}
                {field.type === "SELECT" && (
                  <div className="mt-3">
                    <label className="block text-xs text-gray-500">
                      Optionen (kommagetrennt) *
                    </label>
                    <input
                      type="text"
                      value={field.options}
                      onChange={(e) =>
                        updateField(idx, { options: e.target.value })
                      }
                      required
                      className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? "Wird erstellt..." : "Formular erstellen"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/forms")}
            className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
