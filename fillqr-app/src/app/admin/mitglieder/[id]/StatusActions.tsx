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
  angenommen: "bg-green-600 text-white hover:bg-green-700",
  in_pruefung: "bg-yellow-500 text-white hover:bg-yellow-600",
  abgelehnt: "bg-red-600 text-white hover:bg-red-700",
  eingegangen: "bg-blue-600 text-white hover:bg-blue-700",
  gekuendigt: "bg-gray-600 text-white hover:bg-gray-700",
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
  const [showDialog, setShowDialog] = useState<"gekuendigt" | "abgelehnt" | null>(null);
  const [exitDate, setExitDate] = useState("");
  const [reason, setReason] = useState("");

  const allowed = TRANSITIONS[currentStatus] ?? [];

  if (allowed.length === 0) return null;

  async function changeStatus(newStatus: string, extra?: { exitDate?: string; reason?: string }) {
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { id: memberId, newStatus };
      if (extra?.exitDate) body.exitDate = extra.exitDate;
      if (extra?.reason) body.reason = extra.reason;

      const res = await fetch("/api/trpc/members.updateStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: body }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error?.json?.message ?? data.error?.message ?? "Fehler");
        return;
      }

      setShowDialog(null);
      router.refresh();
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  function handleClick(s: string) {
    if (s === "gekuendigt") {
      setExitDate(new Date().toISOString().split("T")[0]);
      setShowDialog("gekuendigt");
      return;
    }
    if (s === "abgelehnt") {
      setReason("");
      setShowDialog("abgelehnt");
      return;
    }
    if (!confirm(`Status wirklich auf "${STATUS_LABELS[s]}" aendern?`)) return;
    changeStatus(s);
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Status aendern</h2>

      {error && (
        <div className="p-2 mb-3 rounded text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {allowed.map((s) => (
          <button
            key={s}
            onClick={() => handleClick(s)}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 ${BUTTON_COLORS[s] ?? "bg-gray-200"}`}
          >
            {loading ? "..." : `→ ${STATUS_LABELS[s]}`}
          </button>
        ))}
      </div>

      {/* Kündigungs-Dialog */}
      {showDialog === "gekuendigt" && (
        <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Mitglied kuendigen</h3>
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">Austrittsdatum *</label>
            <input
              type="date"
              value={exitDate}
              onChange={(e) => setExitDate(e.target.value)}
              required
              className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!exitDate) { setError("Austrittsdatum ist Pflicht"); return; }
                changeStatus("gekuendigt", { exitDate });
              }}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "..." : "Kuendigung bestaetigen"}
            </button>
            <button onClick={() => setShowDialog(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Ablehnungs-Dialog */}
      {showDialog === "abgelehnt" && (
        <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Antrag ablehnen</h3>
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">Begruendung (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Warum wird der Antrag abgelehnt?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => changeStatus("abgelehnt", { reason: reason || undefined })}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "..." : "Ablehnung bestaetigen"}
            </button>
            <button onClick={() => setShowDialog(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
