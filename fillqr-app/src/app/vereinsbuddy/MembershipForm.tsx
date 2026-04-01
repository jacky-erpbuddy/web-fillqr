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
  sepaAktiv: boolean;
  sepaGlaeubigerId: string;
  ueberweisungAktiv: boolean;
  barAktiv: boolean;
  fotoerlaubnis: boolean;
  newsletter: boolean;
  ehrenamt: boolean;
  spende: boolean;
  mitgliedWirbt: boolean;
  fotoUpload: "aus" | "optional" | "pflicht";
  familienmitgliedschaft: boolean;
};

type Props = {
  tenantName: string;
  tenantStreet: string;
  tenantZip: string;
  tenantCity: string;
  membershipTypes: MembershipTypeOption[];
  departments: DepartmentOption[];
  settings: FormSettings;
  isDemo?: boolean;
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
  isDemo = false,
}: Props) {
  const router = useRouter();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedInterval, setSelectedInterval] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [birthdate, setBirthdate] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  type FamilyMember = {
    firstName: string;
    lastName: string;
    birthdate: string;
    departmentIds: string[];
    photoPath?: string;
    photoPreview?: string;
  };
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  async function handlePhotoUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Datei zu gross (max. 5 MB)");
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setPhotoError("Nur JPG und PNG erlaubt");
      return;
    }
    setPhotoUploading(true);
    setPhotoError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("turnstileToken", turnstileToken ?? "");
    try {
      const res = await fetch("/api/vereinsbuddy/upload-photo", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setPhotoError(data.error ?? "Upload fehlgeschlagen");
        return;
      }
      setPhotoPath(data.path);
      setPhotoPreview(URL.createObjectURL(file));
    } catch {
      setPhotoError("Netzwerkfehler beim Upload");
    } finally {
      setPhotoUploading(false);
    }
  }

  function addFamilyMember() {
    setFamilyMembers((prev) => [...prev, { firstName: "", lastName: "", birthdate: "", departmentIds: [] }]);
  }

  function removeFamilyMember(index: number) {
    setFamilyMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFamilyMember(index: number, field: keyof FamilyMember, value: string | string[]) {
    setFamilyMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  }
  const [ibanError, setIbanError] = useState<string | null>(null);

  // Verfügbare Zahlungsarten aus Settings
  const availablePaymentMethods = useMemo(() => {
    const methods: { value: string; label: string }[] = [];
    if (settings.sepaAktiv) methods.push({ value: "sepa", label: "SEPA-Lastschrift" });
    if (settings.ueberweisungAktiv) methods.push({ value: "ueberweisung", label: "Ueberweisung" });
    if (settings.barAktiv) methods.push({ value: "bar", label: "Barzahlung" });
    return methods;
  }, [settings]);

  function validateIban(value: string): boolean {
    const cleaned = value.replace(/\s/g, "").toUpperCase();
    if (!/^DE\d{20}$/.test(cleaned)) {
      setIbanError("IBAN muss mit DE beginnen und 22 Zeichen lang sein");
      return false;
    }
    setIbanError(null);
    return true;
  }

  const isMinor = useMemo(() => {
    if (!birthdate) return false;
    const birth = new Date(birthdate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age < 18;
  }, [birthdate]);

  function toggleDept(id: string) {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  // ─── AP-13: Live-Beitragsberechnung ───

  const beitrag = useMemo(() => {
    const typ = membershipTypes.find((t) => t.id === selectedTypeId);
    if (!typ) return null;

    // Head-Sparten
    const headSpartenZusatz = departments
      .filter((d) => selectedDepts.includes(d.id))
      .reduce((sum, d) => sum + d.extraFee, 0);

    // Familienmitglieder-Sparten
    const familieSpartenZusatz = familyMembers.reduce((sum, fm) => {
      return sum + departments
        .filter((d) => fm.departmentIds.includes(d.id))
        .reduce((s, d) => s + d.extraFee, 0);
    }, 0);

    // Gesamtbeitrag: Grundbeitrag * (1 + Familienmitglieder) + alle Spartenszusaetze
    const personenAnzahl = 1 + familyMembers.length;
    const monatlich = typ.fee * personenAnzahl + headSpartenZusatz + familieSpartenZusatz;
    const faktor = intervallFaktoren[selectedInterval] ?? 0;
    const summe = faktor > 0 ? monatlich * faktor : null;

    return { monatlich, summe, faktor, intervall: selectedInterval, personenAnzahl };
  }, [selectedTypeId, selectedDepts, selectedInterval, membershipTypes, departments, familyMembers]);

  // ─── Submit ───

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const form = new FormData(e.currentTarget);

    const body: Record<string, unknown> = {
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

    // Foto
    if (photoPath) body.photoPath = photoPath;

    // Familienmitglieder (mit photoPath)
    if (familyMembers.length > 0) {
      body.familyMembers = familyMembers.map((fm) => ({
        firstName: fm.firstName,
        lastName: fm.lastName,
        birthdate: fm.birthdate,
        departmentIds: fm.departmentIds,
        photoPath: fm.photoPath,
      }));
    }

    // Zahlungsart
    body.paymentMethod = selectedPaymentMethod;

    // SEPA-Daten
    if (selectedPaymentMethod === "sepa") {
      const ibanRaw = (form.get("iban") as string) || "";
      if (!validateIban(ibanRaw)) {
        setSubmitting(false);
        return;
      }
      body.sepa = {
        accountHolder: form.get("accountHolder") as string,
        iban: ibanRaw.replace(/\s/g, "").toUpperCase(),
        bic: (form.get("bic") as string) || undefined,
        mandateConsent: !!form.get("mandateConsent"),
      };
    }

    // Zusatzoptionen
    if (settings.fotoerlaubnis) body.photoConsent = !!form.get("photoConsent");
    if (settings.newsletter) body.newsletter = !!form.get("newsletter");
    if (settings.ehrenamt) body.volunteer = !!form.get("volunteer");
    if (settings.spende) {
      const val = parseFloat((form.get("donation") as string) || "0");
      if (val > 0) body.donation = val;
    }
    if (settings.mitgliedWirbt) {
      const ref = (form.get("referredBy") as string) || "";
      if (ref) body.referredBy = ref;
    }

    // Guardian-Daten bei Minderjaehrigen
    if (isMinor) {
      body.guardian = {
        firstName: form.get("guardianFirstName") as string,
        lastName: form.get("guardianLastName") as string,
        email: form.get("guardianEmail") as string,
        phone: (form.get("guardianPhone") as string) || undefined,
        street: (form.get("guardianStreet") as string) || undefined,
        zip: (form.get("guardianZip") as string) || undefined,
        city: (form.get("guardianCity") as string) || undefined,
        consent: !!form.get("guardianConsent"),
      };
    }

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
      <div className="w-full max-w-lg lg:max-w-2xl mx-auto">
        {/* Demo-Banner */}
        {isDemo && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-4 text-sm">
            <span className="font-medium">Demo:</span> Dies ist eine Demo — keine echten Daten eingeben. Formulardaten werden alle 12 Stunden geloescht.
          </div>
        )}

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
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
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

          {/* ─── AP-22: Foto-Upload ─── */}
          {settings.fotoUpload !== "aus" && (
            <div>
              <label className={labelCls}>
                Foto {settings.fotoUpload === "pflicht" ? "*" : "(optional)"}
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png;capture=camera"
                onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                disabled={photoUploading}
                className="text-sm text-gray-500"
              />
              {photoUploading && <p className="text-sm text-gray-500 mt-1">Wird hochgeladen...</p>}
              {photoError && <p className="text-sm text-red-600 mt-1">{photoError}</p>}
              {photoPreview && (
                <img src={photoPreview} alt="Vorschau" className="mt-2 h-32 w-32 object-cover rounded-md border" />
              )}
              {settings.fotoUpload === "pflicht" && !photoPath && (
                <input type="hidden" name="photoRequired" required />
              )}
            </div>
          )}

          {/* ─── Abschnitt 3: Erziehungsberechtigte (Minderjaehrige) ─── */}
          {isMinor && (
            <fieldset className="border border-amber-200 bg-amber-50 rounded-md p-4">
              <legend className="text-lg font-semibold text-gray-900 mb-4">
                Erziehungsberechtigte/r
              </legend>
              <p className="text-sm text-amber-800 mb-4">
                Da das Mitglied minderjaehrig ist, benoetigen wir die Daten eines/r Erziehungsberechtigten.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="guardianFirstName" className={labelCls}>
                      Vorname *
                    </label>
                    <input
                      type="text"
                      id="guardianFirstName"
                      name="guardianFirstName"
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="guardianLastName" className={labelCls}>
                      Nachname *
                    </label>
                    <input
                      type="text"
                      id="guardianLastName"
                      name="guardianLastName"
                      required
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="guardianEmail" className={labelCls}>
                    E-Mail *
                  </label>
                  <input
                    type="email"
                    id="guardianEmail"
                    name="guardianEmail"
                    required
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="guardianPhone" className={labelCls}>
                    Telefon
                  </label>
                  <input
                    type="tel"
                    id="guardianPhone"
                    name="guardianPhone"
                    className={inputCls}
                  />
                </div>

                {/* Abweichende Anschrift */}
                <details className="border border-gray-200 rounded-md bg-white">
                  <summary className="px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
                    Abweichende Anschrift
                  </summary>
                  <div className="px-3 py-3 space-y-3 border-t border-gray-200">
                    <div>
                      <label htmlFor="guardianStreet" className={labelCls}>
                        Strasse
                      </label>
                      <input
                        type="text"
                        id="guardianStreet"
                        name="guardianStreet"
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="guardianZip" className={labelCls}>
                          PLZ
                        </label>
                        <input
                          type="text"
                          id="guardianZip"
                          name="guardianZip"
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="guardianCity" className={labelCls}>
                          Ort
                        </label>
                        <input
                          type="text"
                          id="guardianCity"
                          name="guardianCity"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </details>

                {/* Zustimmungs-Checkbox */}
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="guardianConsent"
                    required
                    className="rounded border-gray-300 mt-0.5"
                  />
                  <span className="text-sm text-gray-700">
                    Ich stimme dem Beitritt meines Kindes zu. *
                  </span>
                </label>

                {/* Hinweis Beitragszahlung */}
                <p className="text-xs text-amber-700 bg-amber-100 p-2 rounded">
                  Hinweis: Die Beitragszahlung erfolgt durch die/den Erziehungsberechtigte/n.
                </p>
              </div>
            </fieldset>
          )}

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

          {/* ─── AP-23: Familienmitglieder ─── */}
          {settings.familienmitgliedschaft && (
            <fieldset>
              <legend className="text-lg font-semibold text-gray-900 mb-4">
                Familienmitglieder
              </legend>
              <p className="text-sm text-gray-500 mb-4">
                Fuege weitere Familienmitglieder hinzu. Alle teilen eine gemeinsame Mitgliedschaft.
              </p>

              {familyMembers.map((fm, idx) => (
                <div key={idx} className="border border-gray-200 rounded-md p-4 mb-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-700">Familienmitglied {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeFamilyMember(idx)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Entfernen
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Vorname *</label>
                      <input
                        type="text"
                        required
                        value={fm.firstName}
                        onChange={(e) => updateFamilyMember(idx, "firstName", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Nachname *</label>
                      <input
                        type="text"
                        required
                        value={fm.lastName}
                        onChange={(e) => updateFamilyMember(idx, "lastName", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className={labelCls}>Geburtsdatum *</label>
                    <input
                      type="date"
                      required
                      value={fm.birthdate}
                      onChange={(e) => updateFamilyMember(idx, "birthdate", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  {departments.length > 0 && (
                    <div className="mt-3">
                      <span className={labelCls}>Sparte</span>
                      <div className="mt-1 space-y-1">
                        {departments.map((d) => (
                          <label key={d.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={fm.departmentIds.includes(d.id)}
                              onChange={() => {
                                const newIds = fm.departmentIds.includes(d.id)
                                  ? fm.departmentIds.filter((id) => id !== d.id)
                                  : [...fm.departmentIds, d.id];
                                updateFamilyMember(idx, "departmentIds", newIds);
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">{d.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Foto pro Familienmitglied */}
                  {settings.fotoUpload !== "aus" && (
                    <div className="mt-3">
                      <label className={labelCls}>Foto {settings.fotoUpload === "pflicht" ? "*" : "(optional)"}</label>
                      {fm.photoPreview && (
                        <img src={fm.photoPreview} alt="Vorschau" className="h-20 w-20 object-cover rounded-md border mb-2" />
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png;capture=camera"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(file.type)) return;
                          const fd = new FormData();
                          fd.append("file", file);
                          fd.append("turnstileToken", turnstileToken ?? "");
                          try {
                            const res = await fetch("/api/vereinsbuddy/upload-photo", { method: "POST", body: fd });
                            const data = await res.json();
                            if (res.ok) {
                              setFamilyMembers((prev) => prev.map((m, i) =>
                                i === idx ? { ...m, photoPath: data.path, photoPreview: URL.createObjectURL(file) } : m
                              ));
                            }
                          } catch { /* ignore */ }
                        }}
                        className="text-sm text-gray-500"
                      />
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addFamilyMember}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Weiteres Familienmitglied hinzufuegen
              </button>
            </fieldset>
          )}

          {/* ─── AP-13: Live-Beitragsberechnung ─── */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              Dein Beitrag
            </h3>
            {beitrag ? (
              <div className="space-y-1 text-sm text-blue-800">
                <p>
                  Monatsbeitrag{beitrag.personenAnzahl > 1 ? ` (${beitrag.personenAnzahl} Personen)` : ""}: <strong>{eur.format(beitrag.monatlich)}</strong>
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

          {/* ─── AP-20: Abschnitt 4 — Zahlungsart ─── */}
          {availablePaymentMethods.length > 0 && (
            <fieldset>
              <legend className="text-lg font-semibold text-gray-900 mb-4">
                Zahlungsart
              </legend>
              <div className="space-y-2">
                {availablePaymentMethods.map((m) => (
                  <label key={m.value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="paymentMethodRadio"
                      value={m.value}
                      checked={selectedPaymentMethod === m.value}
                      onChange={() => setSelectedPaymentMethod(m.value)}
                      required
                      className="border-gray-300"
                    />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* ─── AP-20: Abschnitt 5 — SEPA-Lastschriftmandat ─── */}
          {selectedPaymentMethod === "sepa" && (
            <fieldset className="border border-blue-200 bg-blue-50 rounded-md p-4">
              <legend className="text-lg font-semibold text-gray-900 mb-4">
                SEPA-Lastschriftmandat
              </legend>

              <div className="space-y-4">
                <div>
                  <label htmlFor="accountHolder" className={labelCls}>
                    Kontoinhaber *
                  </label>
                  <input
                    type="text"
                    id="accountHolder"
                    name="accountHolder"
                    required
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="iban" className={labelCls}>
                    IBAN *{isDemo && <span className="text-amber-600 font-normal"> (Test-IBAN)</span>}
                  </label>
                  <input
                    type="text"
                    id="iban"
                    name="iban"
                    required
                    placeholder="DE89 3704 0044 0532 0130 00"
                    defaultValue={isDemo ? "DE89 3704 0044 0532 0130 00" : undefined}
                    onBlur={(e) => validateIban(e.target.value)}
                    className={inputCls}
                  />
                  {ibanError && (
                    <p className="text-sm text-red-600 mt-1">{ibanError}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="bic" className={labelCls}>
                    BIC (optional)
                  </label>
                  <input
                    type="text"
                    id="bic"
                    name="bic"
                    className={inputCls}
                  />
                </div>

                {/* Mandatstext (readonly) */}
                <div className="bg-white border border-gray-200 rounded-md p-3 text-xs text-gray-600">
                  <p>
                    Ich ermaechtige {tenantName}
                    {settings.sepaGlaeubigerId && ` (Glaeubiger-Identifikationsnummer: ${settings.sepaGlaeubigerId})`}
                    , Zahlungen von meinem Konto mittels Lastschrift einzuziehen.
                    Zugleich weise ich mein Kreditinstitut an, die von {tenantName} auf
                    mein Konto gezogenen Lastschriften einzuloesen.
                  </p>
                  <p className="mt-2 text-gray-500">
                    Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem
                    Belastungsdatum, die Erstattung des belasteten Betrages verlangen.
                  </p>
                </div>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="mandateConsent"
                    required
                    className="rounded border-gray-300 mt-0.5"
                  />
                  <span className="text-sm text-gray-700">
                    Ich habe das SEPA-Lastschriftmandat gelesen und erteile es hiermit. *
                  </span>
                </label>
              </div>
            </fieldset>
          )}

          {/* ─── AP-21: Abschnitt 6 — Zusatzoptionen ─── */}
          {(settings.fotoerlaubnis || settings.newsletter || settings.ehrenamt || settings.spende || settings.mitgliedWirbt) && (
            <fieldset>
              <legend className="text-lg font-semibold text-gray-900 mb-4">
                Zusatzoptionen
              </legend>
              <div className="space-y-4">
                {settings.fotoerlaubnis && (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" name="photoConsent" className="rounded border-gray-300 mt-0.5" />
                    <span className="text-sm text-gray-700">
                      Ich bin damit einverstanden, dass Fotos bei Vereinsveranstaltungen gemacht und veroeffentlicht werden duerfen.
                    </span>
                  </label>
                )}
                {settings.newsletter && (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" name="newsletter" className="rounded border-gray-300 mt-0.5" />
                    <span className="text-sm text-gray-700">
                      Ich moechte den Vereinsnewsletter per E-Mail erhalten.
                    </span>
                  </label>
                )}
                {settings.ehrenamt && (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" name="volunteer" className="rounded border-gray-300 mt-0.5" />
                    <span className="text-sm text-gray-700">
                      Ich habe Interesse an ehrenamtlicher Mitarbeit.
                    </span>
                  </label>
                )}
                {settings.spende && (
                  <div>
                    <label htmlFor="donation" className={labelCls}>
                      Ich moechte zusaetzlich spenden (freiwillig)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        id="donation"
                        name="donation"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        className={inputCls + " w-32"}
                      />
                      <span className="text-sm text-gray-500">EUR</span>
                    </div>
                  </div>
                )}
                {settings.mitgliedWirbt && (
                  <div>
                    <label htmlFor="referredBy" className={labelCls}>
                      Wer hat dich geworben?
                    </label>
                    <input
                      type="text"
                      id="referredBy"
                      name="referredBy"
                      placeholder="Name des werbenden Mitglieds"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </fieldset>
          )}

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
                    Beitragsabrechnung, ggf. Bankdaten (IBAN) fuer
                    Lastschrifteinzug
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
