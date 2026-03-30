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

export default function NewTenantPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const slug = (form.get("slug") as string)?.trim().toLowerCase();

    if (slug && RESERVED_SLUGS.includes(slug)) {
      setError("Reservierte Subdomain — bitte andere waehlen");
      setSaving(false);
      return;
    }

    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      setError("Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt");
      setSaving(false);
      return;
    }

    const input = {
      name: form.get("name") as string,
      street: form.get("street") as string,
      zip: form.get("zip") as string,
      city: form.get("city") as string,
      email: form.get("email") as string,
      phone: form.get("phone") as string,
      appKey: form.get("appKey") as string,
      slug,
    };

    try {
      const res = await fetch("/api/trpc/betreiber.createTenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: input }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const msg =
          data.error?.json?.message ??
          data.error?.message ??
          "Fehler beim Anlegen";
        setError(msg);
        setSaving(false);
        return;
      }

      const tenantId = data.result?.data?.json?.id;
      router.push(tenantId ? `/tenants/${tenantId}` : "/tenants");
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Neuen Tenant anlegen
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organisationsname *
          </label>
          <input
            type="text"
            name="name"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Strasse
            </label>
            <input
              type="text"
              name="street"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PLZ
            </label>
            <input
              type="text"
              name="zip"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ort
            </label>
            <input
              type="text"
              name="city"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail
            </label>
            <input
              type="email"
              name="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefon
            </label>
            <input
              type="tel"
              name="phone"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produkt *
            </label>
            <select
              name="appKey"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Bitte waehlen...</option>
              {PRODUCTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subdomain *
            </label>
            <div className="flex items-center">
              <input
                type="text"
                name="slug"
                required
                pattern="[a-z0-9-]+"
                minLength={3}
                maxLength={63}
                placeholder="mein-verein"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md text-sm text-gray-500">
                .fillqr.de
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Wird angelegt..." : "Tenant anlegen"}
          </button>
          <a
            href="/tenants"
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Abbrechen
          </a>
        </div>
      </form>
    </div>
  );
}
