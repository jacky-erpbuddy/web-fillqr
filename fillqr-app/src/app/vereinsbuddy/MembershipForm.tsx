"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Turnstile from "@/components/Turnstile";

// ─── Types ───

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
  aufnahmegebuehr: { aktiv: boolean; betrag: number };
  satzungUrl: string;
  beitragsordnungUrl: string;
  impressum: string;
};

type Props = {
  tenantName: string;
  tenantStreet: string;
  tenantZip: string;
  tenantCity: string;
  membershipTypes: MembershipTypeOption[];
  departments: DepartmentOption[];
  settings: FormSettings;
};

// ─── Constants ───

const intervallLabels: Record<string, string> = {
  monatlich: "Monatlich",
  vierteljaehrlich: "Vierteljaehrlich",
  halbjaehrlich: "Halbjaehrlich",
  jaehrlich: "Jaehrlich",
};

const intervallFaktoren: Record<string, number> = {
  monatlich: 1,
  vierteljaehrlich: 3,
  halbjaehrlich: 6,
  jaehrlich: 12,
};

const inputCls =
  "w-full px-3 py-2 text-base border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const labelCls = "block text-sm font-medium text-gray-700 mb-1";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function today() {
  return new Date().toISOString().split("T")[0];
}

// ─── Main Component ───

export default function MembershipForm({
  tenantName,
  tenantStreet,
  tenantZip,
  tenantCity,
  membershipTypes,
  departments,
  settings,
}: Props) {
  const router = useRouter();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedInterval, setSelectedInterval] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function toggleDept(id: string) {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  // ─── AP-13: Live-Beitragsberechnung ───

  const beitrag = useMemo(() => {
    const typ = membershipTypes.find((t) => t.id === selectedTypeId);
    if (!typ) return null;

    const spartenZusatz = departments
      .filter((d) => selectedDepts.includes(d.id))
      .reduce((sum, d) => sum + d.extraFee, 0);

    const monatlich = typ.fee + spartenZusatz;
    const faktor = intervallFaktoren[selectedInterval] ?? 0;
    const summe = faktor > 0 ? monatlich * faktor : null;

    return { monatlich, summe, faktor, intervall: selectedInterval };
  }, [selectedTypeId, selectedDepts, selectedInterval, membershipTypes, departments]);

  // ─── Submit ───

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const form = new FormData(e.currentTarget);

    const body = {
      turnstileToken,
      firstName: form.get("firstName") as string,
      lastName: form.get("lastName") as string,
      street: form.get("street") as string,
      zip: form.get("zip") as string,
      city: form.get("city") as string,
      email: form.get("email") as string,
      birthdate: form.get("birthdate") as string,
      phone: (form.get("phone") as string) || undefined,
      membershipTypeId: selectedTypeId,
      paymentInterval: selectedInterval,
      entryDate: (form.get("entryDate") as string) || undefined,
      departmentIds: selectedDepts,
    };

    try {
      const res = await fetch("/api/vereinsbuddy/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error ?? "Fehler beim Absenden");
        return;
      }

      router.push(`/vereinsbuddy/success?id=${data.memberId}`);
    } catch {
      setSubmitError("Netzwerkfehler — bitte versuche es erneut");
    } finally {
      setSubmitting(false);
    }
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
                    value={selectedTypeId}
                    onChange={(e) => setSelectedTypeId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="" disabled>
                      Bitte waehlen
                    </option>
                    {membershipTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {eur.format(t.fee)}/Monat
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
                              (+{eur.format(d.extraFee)})
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
                    value={selectedInterval}
                    onChange={(e) => setSelectedInterval(e.target.value)}
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

          {/* ─── AP-13: Live-Beitragsberechnung ─── */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              Dein Beitrag
            </h3>
            {beitrag ? (
              <div className="space-y-1 text-sm text-blue-800">
                <p>
                  Monatsbeitrag: <strong>{eur.format(beitrag.monatlich)}</strong>
                </p>
                {beitrag.summe !== null ? (
                  <p>
                    {intervallLabels[beitrag.intervall] ?? beitrag.intervall}:{" "}
                    <strong>{eur.format(beitrag.summe)}</strong>
                  </p>
                ) : (
                  <p className="text-blue-600">
                    Bitte Zahlungsintervall waehlen
                  </p>
                )}
                {settings.aufnahmegebuehr.aktiv && (
                  <p>
                    Einmalige Aufnahmegebuehr:{" "}
                    <strong>{eur.format(settings.aufnahmegebuehr.betrag)}</strong>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-blue-600">
                Bitte Mitgliedstyp waehlen
              </p>
            )}
          </div>

          {/* ─── AP-14: Abschnitt 7 — Rechtliches ─── */}
          <fieldset>
            <legend className="text-lg font-semibold text-gray-900 mb-4">
              Rechtliches
            </legend>

            <div className="space-y-4">
              {/* Beitrittserklarung */}
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                Hiermit beantrage ich die Aufnahme als Mitglied im{" "}
                <strong>{tenantName}</strong>.
              </p>

              {/* Satzung + Beitragsordnung */}
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="acceptStatutes"
                  required
                  className="rounded border-gray-300 mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  Ich anerkenne die{" "}
                  {settings.satzungUrl ? (
                    <a
                      href={settings.satzungUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Satzung
                    </a>
                  ) : (
                    "Satzung"
                  )}{" "}
                  und{" "}
                  {settings.beitragsordnungUrl ? (
                    <a
                      href={settings.beitragsordnungUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Beitragsordnung
                    </a>
                  ) : (
                    "Beitragsordnung"
                  )}{" "}
                  des Vereins. *
                </span>
              </label>

              {/* Datenschutzhinweis */}
              <details className="border border-gray-200 rounded-md">
                <summary className="px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                  Datenschutzhinweis nach Art. 13 DSGVO
                </summary>
                <div className="px-3 py-3 text-xs text-gray-600 space-y-2 border-t border-gray-200">
                  <p>
                    <strong>Verantwortlicher:</strong> {tenantName}
                    {tenantStreet && `, ${tenantStreet}`}
                    {tenantZip && tenantCity && `, ${tenantZip} ${tenantCity}`}
                  </p>
                  <p>
                    <strong>Zweck:</strong> Mitgliederverwaltung,
                    Beitragsabrechnung
                  </p>
                  <p>
                    <strong>Rechtsgrundlage:</strong> Vertrag (Art. 6 Abs. 1b
                    DSGVO)
                  </p>
                  <p>
                    <strong>Empfaenger:</strong> Vorstand, Kasse, ggf. Bank
                    (SEPA)
                  </p>
                  <p>
                    <strong>Auftragsverarbeiter:</strong> fillQR
                    (IT-Dienstleister)
                  </p>
                  <p>
                    <strong>Speicherdauer:</strong> Dauer der Mitgliedschaft +
                    gesetzliche Aufbewahrungsfristen
                  </p>
                  <p>
                    <strong>Betroffenenrechte:</strong> Auskunft, Berichtigung,
                    Loeschung, Einschraenkung, Datenportabilitaet, Beschwerde bei
                    der zustaendigen Aufsichtsbehoerde
                  </p>
                </div>
              </details>

              {/* Angaben richtig */}
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="acceptCorrectness"
                  required
                  className="rounded border-gray-300 mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  Meine Angaben sind richtig und vollstaendig. *
                </span>
              </label>
            </div>
          </fieldset>

          {/* ─── Turnstile ─── */}
          <div>
            <Turnstile onSuccess={setTurnstileToken} />
          </div>

          {/* ─── Submit ─── */}
          <div>
            {submitError && (
              <div className="p-3 rounded text-sm bg-red-50 border border-red-200 text-red-700 mb-3">
                {submitError}
              </div>
            )}
            <button
              type="submit"
              disabled={!turnstileToken || submitting}
              className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {submitting ? "Wird gesendet..." : "Antrag verbindlich absenden"}
            </button>
            {!turnstileToken && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Bitte die Sicherheitspruefung abschliessen
              </p>
            )}
          </div>

          {/* ─── Impressum-Link ─── */}
          {settings.impressum && (
            <div className="text-center pt-2 border-t border-gray-100">
              <details className="inline-block">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                  Impressum
                </summary>
                <p className="text-xs text-gray-500 mt-2 whitespace-pre-line text-left">
                  {settings.impressum}
                </p>
              </details>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
