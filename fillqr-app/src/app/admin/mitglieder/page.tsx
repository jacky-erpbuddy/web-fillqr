"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type MemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
  membershipType: { name: string; fee: string } | null;
  departments: { department: { name: string } }[];
};

const STATUS_COLORS: Record<string, string> = {
  eingegangen: "bg-blue-100 text-blue-800",
  in_pruefung: "bg-yellow-100 text-yellow-800",
  angenommen: "bg-green-100 text-green-800",
  abgelehnt: "bg-red-100 text-red-800",
  gekuendigt: "bg-gray-100 text-gray-800",
};

const STATUS_OPTIONS = [
  { value: "", label: "Alle Status" },
  { value: "eingegangen", label: "Eingegangen" },
  { value: "in_pruefung", label: "In Pruefung" },
  { value: "angenommen", label: "Angenommen" },
  { value: "abgelehnt", label: "Abgelehnt" },
  { value: "gekuendigt", label: "Gekuendigt" },
];

const selectCls =
  "px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";

async function trpcQuery(procedure: string, input: Record<string, unknown>) {
  const encoded = encodeURIComponent(JSON.stringify({ json: input }));
  const res = await fetch(`/api/trpc/${procedure}?input=${encoded}`);
  const data = await res.json();
  return data.result?.data?.json ?? data.result?.data;
}

export default function MitgliederPage() {
  const [items, setItems] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [cursor, setCursor] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const fetchData = useCallback(
    async (cursorVal?: string) => {
      setLoading(true);
      const input: Record<string, unknown> = { sortBy, limit: 20 };
      if (status) input.status = status;
      if (search) input.search = search;
      if (cursorVal) input.cursor = cursorVal;

      const result = await trpcQuery("members.list", input);
      setItems(result.items ?? []);
      setNextCursor(result.nextCursor ?? null);
      setLoading(false);
    },
    [status, search, sortBy],
  );

  useEffect(() => {
    setCursor(undefined);
    setPrevCursors([]);
    fetchData();
  }, [fetchData]);

  function goNext() {
    if (!nextCursor) return;
    setPrevCursors((prev) => [...prev, cursor ?? ""]);
    setCursor(nextCursor);
    fetchData(nextCursor);
  }

  function goPrev() {
    const prev = [...prevCursors];
    const last = prev.pop();
    setPrevCursors(prev);
    setCursor(last || undefined);
    fetchData(last || undefined);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mitglieder</h1>
        <a
          href={`/api/admin/members/export?status=${status}&search=${search}`}
          className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Exportieren (CSV)
        </a>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectCls}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Name oder E-Mail suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${selectCls} flex-1 min-w-[200px]`}
        />

        <button
          onClick={() => setSortBy(sortBy === "date" ? "name" : "date")}
          className={selectCls}
        >
          Sortierung: {sortBy === "date" ? "Datum" : "Name"}
        </button>
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">
            Laden...
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">
            Keine Mitglieder gefunden.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">
                  Sparte(n)
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden md:table-cell">
                  Mitgliedstyp
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 hidden lg:table-cell">
                  Datum
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/mitglieder/${m.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {m.firstName} {m.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[m.status] ?? "bg-gray-100"}`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {m.departments.map((d) => d.department.name).join(", ") ||
                      "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {m.membershipType?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">
                    {new Date(m.createdAt).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-between mt-4">
        <button
          onClick={goPrev}
          disabled={prevCursors.length === 0}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-30 hover:bg-gray-50"
        >
          ← Vorherige
        </button>
        <button
          onClick={goNext}
          disabled={!nextCursor}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-30 hover:bg-gray-50"
        >
          Naechste →
        </button>
      </div>
    </div>
  );
}
