"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelCls = "block text-sm font-medium text-gray-700 mb-1";

type MemberData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
  birthdate: string;
  notes: string;
  membershipTypeId: string;
  paymentInterval: string;
  paymentMethod: string;
};

export default function EditMemberForm({ member }: { member: MemberData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);

    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = { id: member.id };

    const fields = ["firstName", "lastName", "email", "phone", "street", "zip", "city", "birthdate", "notes"];
    for (const f of fields) {
      body[f] = (fd.get(f) as string) ?? "";
    }

    try {
      const res = await fetch("/api/trpc/members.update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: body }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error?.json?.message ?? "Fehler beim Speichern");
        return;
      }
      setMsg("Aenderungen gespeichert");
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 max-w-2xl">
      {error && <div className="p-3 rounded text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
      {msg && <div className="p-3 rounded text-sm bg-green-50 border border-green-200 text-green-700">{msg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Vorname *</label>
          <input type="text" name="firstName" defaultValue={member.firstName} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Nachname *</label>
          <input type="text" name="lastName" defaultValue={member.lastName} required className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>E-Mail *</label>
        <input type="email" name="email" defaultValue={member.email} required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Telefon</label>
        <input type="tel" name="phone" defaultValue={member.phone} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Strasse</label>
        <input type="text" name="street" defaultValue={member.street} className={inputCls} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>PLZ</label>
          <input type="text" name="zip" defaultValue={member.zip} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Ort</label>
          <input type="text" name="city" defaultValue={member.city} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Geburtsdatum</label>
        <input type="date" name="birthdate" defaultValue={member.birthdate} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Notizen</label>
        <textarea name="notes" defaultValue={member.notes} rows={3} className={inputCls} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Speichert..." : "Aenderungen speichern"}
        </button>
        <button type="button" onClick={() => router.push(`/admin/mitglieder/${member.id}`)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
          Zurueck
        </button>
      </div>
    </form>
  );
}
