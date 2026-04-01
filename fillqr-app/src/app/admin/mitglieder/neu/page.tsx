"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelCls = "block text-sm font-medium text-gray-700 mb-1";

export default function NewMemberPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      email: fd.get("email") as string,
      phone: (fd.get("phone") as string) || undefined,
      street: (fd.get("street") as string) || undefined,
      zip: (fd.get("zip") as string) || undefined,
      city: (fd.get("city") as string) || undefined,
      birthdate: (fd.get("birthdate") as string) || undefined,
      status: fd.get("status") as string,
    };

    try {
      const res = await fetch("/api/trpc/members.create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: body }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error?.json?.message ?? "Fehler beim Anlegen");
        return;
      }
      const memberId = data.result?.data?.json?.id ?? data.result?.data?.id;
      router.push(`/admin/mitglieder/${memberId}`);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mitglied anlegen</h1>

      {error && (
        <div className="p-3 rounded text-sm bg-red-50 border border-red-200 text-red-700 mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Vorname *</label>
            <input type="text" name="firstName" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nachname *</label>
            <input type="text" name="lastName" required className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>E-Mail *</label>
          <input type="email" name="email" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Telefon</label>
          <input type="tel" name="phone" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Strasse</label>
          <input type="text" name="street" className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>PLZ</label>
            <input type="text" name="zip" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Ort</label>
            <input type="text" name="city" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Geburtsdatum</label>
          <input type="date" name="birthdate" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select name="status" defaultValue="eingegangen" className={inputCls}>
            <option value="eingegangen">Eingegangen</option>
            <option value="angenommen">Angenommen (Mitgliedsnr. wird vergeben)</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Speichert..." : "Mitglied anlegen"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Abbrechen
          </button>
        </div>
      </form>
    </div>
  );
}
