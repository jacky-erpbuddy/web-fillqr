"use client";

import { useState } from "react";
import Turnstile from "@/components/Turnstile";

type MembershipTypeOption = {
  id: string;
  name: string;
  fee: number;
};

type DepartmentOption = {
  id: string;
  name: string;
  extraFee: number;
};

type FormSettings = {
  zahlungsintervalle: string[];
  telefonSichtbar: boolean;
};

type Props = {
  tenantName: string;
  membershipTypes: MembershipTypeOption[];
  departments: DepartmentOption[];
  settings: FormSettings;
};

const intervallLabels: Record<string, string> = {
  monatlich: "Monatlich",
  vierteljaehrlich: "Vierteljährlich",
  halbjaehrlich: "Halbjährlich",
  jaehrlich: "Jährlich",
};

const inputCls =
  "w-full px-3 py-2 text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelCls = "block text-sm font-medium text-gray-700 mb-1";

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function MembershipForm({
  tenantName,
  membershipTypes,
  departments,
  settings,
}: Props) {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  function toggleDept(id: string) {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // AP-15 wird die Server-Logik implementieren
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Vielen Dank!
          </h1>
          <p className="text-gray-600">
            Dein Mitgliedsantrag wird vorbereitet. Die Verarbeitung wird in
            Kuerze verfuegbar sein.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{tenantName}</h1>
          <p className="text-gray-500 mt-1">Mitgliedsantrag</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-8"
        >
          {/* ─── Abschnitt 1: Persoenliche Daten ─── */}
          <fieldset>
            <legend className="text-lg font-semibold text-gray-900 mb-4">
              Persoenliche Daten
            </legend>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className={labelCls}>
                    Vorname *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    required
                    autoComplete="given-name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelCls}>
                    Nachname *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    required
                    autoComplete="family-name"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="street" className={labelCls}>
                  Strasse *
                </label>
                <input
                  type="text"
                  id="street"
                  name="street"
                  required
                  autoComplete="street-address"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="zip" className={labelCls}>
                    PLZ *
                  </label>
                  <input
                    type="text"
                    id="zip"
                    name="zip"
                    required
                    autoComplete="postal-code"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="city" className={labelCls}>
                    Ort *
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    required
                    autoComplete="address-level2"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="birthdate" className={labelCls}>
                  Geburtsdatum *
                </label>
                <input
                  type="date"
                  id="birthdate"
                  name="birthdate"
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="email" className={labelCls}>
                  E-Mail *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  autoComplete="email"
                  className={inputCls}
                />
              </div>

              {settings.telefonSichtbar && (
                <div>
                  <label htmlFor="phone" className={labelCls}>
                    Telefon
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    autoComplete="tel"
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          </fieldset>

          {/* ─── Abschnitt 2: Mitgliedschaftsauswahl ─── */}
          <fieldset>
            <legend className="text-lg font-semibold text-gray-900 mb-4">
              Mitgliedschaft
            </legend>

            <div className="space-y-4">
              {/* Mitgliedstyp */}
              <div>
                <label htmlFor="membershipTypeId" className={labelCls}>
                  Mitgliedstyp *
                </label>
                {membershipTypes.length > 0 ? (
                  <select
                    id="membershipTypeId"
                    name="membershipTypeId"
                    required
                    defaultValue=""
                    className={inputCls}
                  >
                    <option value="" disabled>
                      Bitte waehlen
                    </option>
                    {membershipTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.fee.toFixed(2)} EUR/Monat
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500">
                    Noch keine Mitgliedstypen konfiguriert.
                  </p>
                )}
              </div>

              {/* Abteilungen/Sparten */}
              {departments.length > 0 && (
                <div>
                  <span className={labelCls}>Abteilung / Sparte</span>
                  <div className="mt-2 space-y-2">
                    {departments.map((d) => (
                      <label key={d.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="departmentIds"
                          value={d.id}
                          checked={selectedDepts.includes(d.id)}
                          onChange={() => toggleDept(d.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">
                          {d.name}
                          {d.extraFee > 0 && (
                            <span className="text-gray-500">
                              {" "}
                              (+{d.extraFee.toFixed(2)} EUR)
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Zahlungsintervall */}
              <div>
                <label htmlFor="paymentInterval" className={labelCls}>
                  Zahlungsintervall *
                </label>
                {settings.zahlungsintervalle.length > 0 ? (
                  <select
                    id="paymentInterval"
                    name="paymentInterval"
                    required
                    defaultValue=""
                    className={inputCls}
                  >
                    <option value="" disabled>
                      Bitte waehlen
                    </option>
                    {settings.zahlungsintervalle.map((v) => (
                      <option key={v} value={v}>
                        {intervallLabels[v] ?? v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-gray-500">
                    Noch keine Zahlungsintervalle konfiguriert.
                  </p>
                )}
              </div>

              {/* Eintrittsdatum */}
              <div>
                <label htmlFor="entryDate" className={labelCls}>
                  Gewuenschtes Eintrittsdatum
                </label>
                <input
                  type="date"
                  id="entryDate"
                  name="entryDate"
                  defaultValue={today()}
                  className={inputCls}
                />
              </div>
            </div>
          </fieldset>

          {/* ─── Turnstile ─── */}
          <div>
            <Turnstile onSuccess={setTurnstileToken} />
          </div>

          {/* ─── Submit ─── */}
          <div>
            <button
              type="submit"
              disabled={!turnstileToken}
              className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              Antrag absenden
            </button>
            {!turnstileToken && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Bitte die Sicherheitspruefung abschliessen
              </p>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
