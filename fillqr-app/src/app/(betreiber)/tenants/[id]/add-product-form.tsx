"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const RESERVED_SLUGS = [
  "app",
  "www",
  "admin",
  "xpgad",
  "demo",
  "api",
  "mail",
  "ftp",
  "cdn",
  "static",
];

const PRODUCTS = [
  { key: "vereinsbuddy", label: "VereinsBuddy" },
  { key: "trainerfeedback", label: "TrainerFeedback" },
  { key: "messebuddy", label: "MesseBuddy" },
];

export default function AddProductForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        + Weiteres Produkt hinzufuegen
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const slug = (form.get("slug") as string)?.trim().toLowerCase();

    if (slug && RESERVED_SLUGS.includes(slug)) {
      setError("Reservierte Subdomain");
      setSaving(false);
      return;
    }

    const input = {
      tenantId,
      appKey: form.get("appKey") as string,
      slug,
    };

    try {
      const res = await fetch("/api/trpc/betreiber.addProductToTenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: input }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(
          data.error?.json?.message ??
            data.error?.message ??
            "Fehler beim Hinzufuegen",
        );
        setSaving(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3"
    >
      <h3 className="text-sm font-medium text-gray-700">
        Produkt hinzufuegen
      </h3>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <select
          name="appKey"
          required
          className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Produkt waehlen...</option>
          {PRODUCTS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="flex items-center">
          <input
            type="text"
            name="slug"
            required
            pattern="[a-z0-9-]+"
            minLength={3}
            maxLength={63}
            placeholder="subdomain"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="px-2 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md text-xs text-gray-500">
            .fillqr.de
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "..." : "Hinzufuegen"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-gray-600 text-sm hover:text-gray-800"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
