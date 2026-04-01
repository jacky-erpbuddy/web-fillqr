"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

const MEMBER_FIELDS = [
  { key: "firstName", label: "Vorname *", required: true },
  { key: "lastName", label: "Nachname *", required: true },
  { key: "email", label: "E-Mail *", required: true },
  { key: "phone", label: "Telefon" },
  { key: "street", label: "Strasse" },
  { key: "zip", label: "PLZ" },
  { key: "city", label: "Ort" },
];

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

export default function ImportPage() {
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setError("CSV muss mindestens eine Kopfzeile + eine Datenzeile haben");
        return;
      }

      // Separator erkennen (Semikolon oder Komma)
      const sep = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, "").trim());
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(sep).map((v) => v.replace(/^"|"$/g, "").trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = vals[i] ?? "";
        });
        return row;
      });

      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-Mapping versuchen
      const auto: Record<string, string> = {};
      for (const field of MEMBER_FIELDS) {
        const match = headers.find(
          (h) => h.toLowerCase().includes(field.key.toLowerCase()) || h.toLowerCase().includes(field.label.replace(" *", "").toLowerCase()),
        );
        if (match) auto[field.key] = match;
      }
      setMapping(auto);
    };
    reader.readAsText(file, "utf-8");
  }, []);

  async function handleImport() {
    if (!mapping.firstName || !mapping.lastName || !mapping.email) {
      setError("Vorname, Nachname und E-Mail muessen zugeordnet sein");
      return;
    }
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/members/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: csvRows, mapping }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import fehlgeschlagen");
        return;
      }
      setResult(data);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/einstellungen" className="text-sm text-blue-600 hover:text-blue-800">
          ← Zurueck zu Einstellungen
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">CSV-Import</h1>
      <p className="text-sm text-gray-500 mb-4">
        Importiere Bestandsmitglieder aus einer CSV-Datei. Duplikate (gleiche E-Mail) werden uebersprungen.
      </p>

      {/* Upload */}
      <div className="mb-6">
        <input type="file" accept=".csv" onChange={handleFileUpload} className="text-sm text-gray-500" />
      </div>

      {error && (
        <div className="p-3 rounded text-sm bg-red-50 border border-red-200 text-red-700 mb-4">{error}</div>
      )}

      {/* Mapping */}
      {csvHeaders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Spalten-Zuordnung</h2>
          <div className="space-y-2">
            {MEMBER_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <span className="text-sm w-32 text-gray-700">{field.label}</span>
                <select
                  value={mapping[field.key] ?? ""}
                  onChange={(e) => setMapping((p) => ({ ...p, [field.key]: e.target.value }))}
                  className={inputCls + " w-48"}
                >
                  <option value="">— Nicht zuordnen —</option>
                  {csvHeaders.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vorschau */}
      {csvRows.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Vorschau (erste 5 von {csvRows.length} Zeilen)
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {csvHeaders.map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {csvHeaders.map((h) => (
                      <td key={h} className="px-3 py-2 text-gray-700">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import-Button */}
      {csvRows.length > 0 && !result && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {importing ? `Importiert ${csvRows.length} Zeilen...` : `${csvRows.length} Zeilen importieren`}
        </button>
      )}

      {/* Ergebnis */}
      {result && (
        <div className="p-4 rounded-md border bg-green-50 border-green-200">
          <h3 className="font-semibold text-green-800 mb-2">Import abgeschlossen</h3>
          <p className="text-sm text-green-700">
            {result.imported} importiert, {result.skipped} Duplikate uebersprungen
            {result.errors.length > 0 && `, ${result.errors.length} Fehler`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
