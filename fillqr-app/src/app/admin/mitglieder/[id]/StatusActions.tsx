"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TRANSITIONS: Record<string, string[]> = {
  eingegangen: ["in_pruefung", "angenommen", "abgelehnt"],
  in_pruefung: ["angenommen", "abgelehnt"],
  angenommen: ["gekuendigt"],
  abgelehnt: ["eingegangen"],
  gekuendigt: [],
};

const STATUS_LABELS: Record<string, string> = {
  eingegangen: "Eingegangen",
  in_pruefung: "In Pruefung",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
  gekuendigt: "Gekuendigt",
};

const BUTTON_COLORS: Record<string, string> = {
  angenommen:
    "bg-green-600 text-white hover:bg-green-700",
  in_pruefung:
    "bg-yellow-500 text-white hover:bg-yellow-600",
  abgelehnt:
    "bg-red-600 text-white hover:bg-red-700",
  eingegangen:
    "bg-blue-600 text-white hover:bg-blue-700",
  gekuendigt:
    "bg-gray-600 text-white hover:bg-gray-700",
};

export default function StatusActions({
  memberId,
  currentStatus,
}: {
  memberId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowed = TRANSITIONS[currentStatus] ?? [];

  if (allowed.length === 0) return null;

  async function changeStatus(newStatus: string) {
    if (
      !confirm(
        `Status wirklich auf "${STATUS_LABELS[newStatus]}" aendern?`,
      )
    )
      return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/trpc/members.updateStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { id: memberId, newStatus } }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(
          data.error?.json?.message ?? data.error?.message ?? "Fehler",
        );
        return;
      }

      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">
        Status aendern
      </h2>

      {error && (
        <div className="p-2 mb-3 rounded text-sm bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {allowed.map((s) => (
          <button
            key={s}
            onClick={() => changeStatus(s)}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 ${BUTTON_COLORS[s] ?? "bg-gray-200"}`}
          >
            {loading ? "..." : `→ ${STATUS_LABELS[s]}`}
          </button>
        ))}
      </div>
    </div>
  );
}
