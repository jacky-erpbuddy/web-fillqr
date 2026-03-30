"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TenantData = {
  id: string;
  name: string;
  street: string | null;
  zip: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  status: string;
};

const STATUS_OPTIONS = [
  { value: "active", label: "Aktiv" },
  { value: "trial", label: "Trial" },
  { value: "paused", label: "Pausiert" },
  { value: "cancelled", label: "Gekuendigt" },
];

export default function TenantEditForm({ tenant }: { tenant: TenantData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const form = new FormData(e.currentTarget);

    const input = {
      id: tenant.id,
      name: form.get("name") as string,
      street: form.get("street") as string,
      zip: form.get("zip") as string,
      city: form.get("city") as string,
      email: form.get("email") as string,
      phone: form.get("phone") as string,
      status: form.get("status") as string,
    };

    try {
      const res = await fetch("/api/trpc/betreiber.updateTenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: input }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessage({
          type: "error",
          text:
            data.error?.json?.message ??
            data.error?.message ??
            "Fehler beim Speichern",
        });
      } else {
        setMessage({ type: "success", text: "Gespeichert" });
        router.refresh();
      }
    } catch {
      setMessage({ type: "error", text: "Netzwerkfehler" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded text-sm ${message.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            type="text"
            name="name"
            defaultValue={tenant.name}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={tenant.status}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Strasse
        </label>
        <input
          type="text"
          name="street"
          defaultValue={tenant.street ?? ""}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PLZ
          </label>
          <input
            type="text"
            name="zip"
            defaultValue={tenant.zip ?? ""}
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
            defaultValue={tenant.city ?? ""}
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
            defaultValue={tenant.email ?? ""}
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
            defaultValue={tenant.phone ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Speichert..." : "Speichern"}
        </button>
      </div>
    </form>
  );
}
