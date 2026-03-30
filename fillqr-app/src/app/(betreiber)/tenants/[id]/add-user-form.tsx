"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddUserForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        + User einladen
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string)?.trim().toLowerCase();

    try {
      const res = await fetch("/api/trpc/betreiber.addUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { tenantId, email } }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(
          data.error?.json?.message ??
            data.error?.message ??
            "Fehler beim Einladen",
        );
        setSaving(false);
        return;
      }

      setSuccess("Einladungs-Mail gesendet!");
      setSaving(false);
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
      <h3 className="text-sm font-medium text-gray-700">User einladen</h3>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="admin@kunde.de"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Sende..." : "Einladung senden"}
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
