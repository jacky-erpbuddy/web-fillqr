"use client";

import { useState } from "react";

type FormField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  config: unknown;
  sortOrder: number;
};

type Props = {
  tenantSlug: string;
  formSlug: string;
  fields: FormField[];
};

type FieldErrors = Record<string, string>;

export function FormRenderer({ tenantSlug, formSlug, fields }: Props) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const initial: Record<string, string | boolean> = {};
    for (const f of fields) {
      initial[f.key] = f.type === "CHECKBOX" ? false : "";
    }
    return initial;
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  function setValue(key: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear field error on change
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  /** Client-side validation (supplement, server is authoritative) */
  function validate(): FieldErrors {
    const errs: FieldErrors = {};

    for (const field of fields) {
      const val = values[field.key];
      const isEmpty =
        val === undefined ||
        val === null ||
        val === "" ||
        (field.type === "CHECKBOX" && val === false);

      if (field.required && isEmpty) {
        errs[field.key] = "Pflichtfeld";
        continue;
      }

      if (isEmpty) continue;

      if (field.type === "EMAIL" && typeof val === "string") {
        if (!/.+@.+\..+/.test(val)) {
          errs[field.key] = "Ungültige E-Mail-Adresse";
        }
      }

      if (field.type === "DATE" && typeof val === "string") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
          errs[field.key] = "Datum im Format YYYY-MM-DD";
        }
      }
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);

    // Client validation
    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);

    try {
      const body = {
        json: {
          tenantSlug,
          formSlug,
          payload: values,
        },
      };

      const res = await fetch("/api/trpc/submission.create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.error?.json?.message ??
          data?.error?.message ??
          "Fehler beim Absenden";
        setGlobalError(msg);
        return;
      }

      setSubmitted(true);
    } catch {
      setGlobalError("Netzwerkfehler — bitte erneut versuchen");
    } finally {
      setSubmitting(false);
    }
  }

  // Success state
  if (submitted) {
    return (
      <div className="rounded-lg bg-white border border-gray-200 p-8 text-center">
        <div className="text-4xl mb-4">&#10003;</div>
        <h2 className="text-xl font-semibold text-gray-900">
          Vielen Dank!
        </h2>
        <p className="mt-2 text-gray-600">
          Ihre Angaben wurden erfolgreich übermittelt.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-lg bg-white border border-gray-200 p-6 sm:p-8"
    >
      <div className="space-y-5">
        {fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={values[field.key]}
            error={errors[field.key]}
            onChange={(val) => setValue(field.key, val)}
          />
        ))}
      </div>

      {/* Global error */}
      {globalError && (
        <div className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {globalError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-md bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {submitting ? "Wird gesendet..." : "Absenden"}
      </button>
    </form>
  );
}

// -- Field Components --------------------------------------------------------

type FieldInputProps = {
  field: FormField;
  value: string | boolean;
  error?: string;
  onChange: (value: string | boolean) => void;
};

function FieldInput({ field, value, error, onChange }: FieldInputProps) {
  const id = `field-${field.key}`;
  const hasError = !!error;

  const labelEl = (
    <label
      htmlFor={id}
      className="block text-sm font-medium text-gray-700 mb-1"
    >
      {field.label}
      {field.required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );

  const errorEl = hasError ? (
    <p className="mt-1 text-sm text-red-600">{error}</p>
  ) : null;

  const inputClasses = `block w-full rounded-md border px-3 py-2 text-base sm:text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
    hasError ? "border-red-300" : "border-gray-300"
  }`;

  switch (field.type) {
    case "TEXT":
      return (
        <div>
          {labelEl}
          <input
            id={id}
            type="text"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
          {errorEl}
        </div>
      );

    case "TEXTAREA":
      return (
        <div>
          {labelEl}
          <textarea
            id={id}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={inputClasses}
          />
          {errorEl}
        </div>
      );

    case "EMAIL":
      return (
        <div>
          {labelEl}
          <input
            id={id}
            type="email"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
          {errorEl}
        </div>
      );

    case "PHONE":
      return (
        <div>
          {labelEl}
          <input
            id={id}
            type="tel"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
          {errorEl}
        </div>
      );

    case "SELECT": {
      const config = field.config as { options?: string[] } | null;
      const options = config?.options ?? [];
      return (
        <div>
          {labelEl}
          <select
            id={id}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          >
            <option value="">Bitte wählen...</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {errorEl}
        </div>
      );
    }

    case "CHECKBOX":
      return (
        <div>
          <label
            htmlFor={id}
            className="flex items-center gap-3 text-sm text-gray-700"
          >
            <input
              id={id}
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span>
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
          </label>
          {errorEl}
        </div>
      );

    case "DATE":
      return (
        <div>
          {labelEl}
          <input
            id={id}
            type="date"
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
          />
          {errorEl}
        </div>
      );

    default:
      return null;
  }
}
