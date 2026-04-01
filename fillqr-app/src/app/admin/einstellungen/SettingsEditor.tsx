"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { VereinsBuddySettings } from "@/lib/settings-schema";
import { EMAIL_DEFAULTS } from "@/lib/email-defaults";

// ─── Types ───

type TenantInfo = {
  id: string;
  name: string;
  street: string | null;
  zip: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  logoPath: string | null;
};

type DepartmentRow = {
  id: string;
  name: string;
  extraFee: number;
  isActive: boolean;
};

type MembershipTypeRow = {
  id: string;
  name: string;
  fee: number;
  isActive: boolean;
};

type Props = {
  tenant: TenantInfo;
  departments: DepartmentRow[];
  membershipTypes: MembershipTypeRow[];
  settings: VereinsBuddySettings;
};

// ─── Helpers ───

async function trpcMutate(procedure: string, input: unknown) {
  const res = await fetch(`/api/trpc/${procedure}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: input }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg =
      data.error?.json?.message ?? data.error?.message ?? "Fehler beim Speichern";
    throw new Error(msg);
  }
  return data.result?.data?.json ?? data.result?.data;
}

function Message({ msg }: { msg: { type: "success" | "error"; text: string } | null }) {
  if (!msg) return null;
  const cls =
    msg.type === "success"
      ? "bg-green-50 border-green-200 text-green-700"
      : "bg-red-50 border-red-200 text-red-700";
  return <div className={`p-3 rounded text-sm border ${cls}`}>{msg.text}</div>;
}

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const btnPrimary =
  "px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary =
  "px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50";

// ─── Tabs ───

const TABS = [
  "Vereinsdaten",
  "Sparten",
  "Mitgliedstypen",
  "Zahlungsoptionen",
  "Optionale Felder",
  "Dokumente",
  "Impressum",
  "E-Mail-Vorlagen",
] as const;

// ─── Main Component ───

export default function SettingsEditor({
  tenant: initialTenant,
  departments: initialDepts,
  membershipTypes: initialTypes,
  settings: initialSettings,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex flex-wrap gap-1 -mb-px">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 0 && <VereindatenTab tenant={initialTenant} />}
      {activeTab === 1 && <SpartenTab departments={initialDepts} />}
      {activeTab === 2 && <MitgliedstypenTab membershipTypes={initialTypes} />}
      {activeTab === 3 && <ZahlungsoptionenTab settings={initialSettings} />}
      {activeTab === 4 && <OptionaleFelderTab settings={initialSettings} />}
      {activeTab === 5 && <DokumenteTab settings={initialSettings} />}
      {activeTab === 6 && <ImpressumTab settings={initialSettings} />}
      {activeTab === 7 && <EmailVorlagenTab />}
    </div>
  );
}

// ─── Tab 1: Vereinsdaten ───

function VereindatenTab({ tenant }: { tenant: TenantInfo }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [logoPath, setLogoPath] = useState(tenant.logoPath);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await trpcMutate("settings.updateTenantInfo", {
        name: fd.get("name") as string,
        street: fd.get("street") as string,
        zip: fd.get("zip") as string,
        city: fd.get("city") as string,
        email: fd.get("email") as string,
        phone: fd.get("phone") as string,
      });
      setMsg({ type: "success", text: "Vereinsdaten gespeichert" });
      router.refresh();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "logo");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen");
      setLogoPath(data.path);
      setMsg({ type: "success", text: "Logo hochgeladen" });
      router.refresh();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Upload-Fehler" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Message msg={msg} />

      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
        {logoPath && (
          <div className="mb-2">
            <img src={logoPath} alt="Logo" className="h-16 object-contain" />
          </div>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={handleLogoUpload}
          disabled={uploading}
          className="text-sm text-gray-500"
        />
        {uploading && <p className="text-sm text-gray-500 mt-1">Wird hochgeladen...</p>}
      </div>

      {/* Formular */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input type="text" name="name" defaultValue={tenant.name} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Strasse</label>
          <input type="text" name="street" defaultValue={tenant.street ?? ""} className={inputCls} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
            <input type="text" name="zip" defaultValue={tenant.zip ?? ""} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
            <input type="text" name="city" defaultValue={tenant.city ?? ""} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
            <input type="email" name="email" defaultValue={tenant.email ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input type="tel" name="phone" defaultValue={tenant.phone ?? ""} className={inputCls} />
          </div>
        </div>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Speichert..." : "Speichern"}
        </button>
      </form>
    </div>
  );
}

// ─── Tab 2: Sparten ───

function SpartenTab({ departments: initial }: { departments: DepartmentRow[] }) {
  const router = useRouter();
  const [depts, setDepts] = useState(initial);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      const result = await trpcMutate("settings.createDepartment", {
        name: fd.get("name") as string,
        extraFee: Number(fd.get("extraFee")) || 0,
      });
      setDepts((prev) => [...prev, { ...result, extraFee: Number(result.extraFee) }]);
      setMsg({ type: "success", text: "Sparte angelegt" });
      e.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await trpcMutate("settings.updateDepartment", {
        id,
        name: fd.get("name") as string,
        extraFee: Number(fd.get("extraFee")) || 0,
      });
      setDepts((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, name: fd.get("name") as string, extraFee: Number(fd.get("extraFee")) || 0 }
            : d,
        ),
      );
      setEditId(null);
      setMsg({ type: "success", text: "Sparte aktualisiert" });
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    setMsg(null);
    try {
      await trpcMutate("settings.toggleDepartment", { id, isActive: !isActive });
      setDepts((prev) => prev.map((d) => (d.id === id ? { ...d, isActive: !isActive } : d)));
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    }
  }

  return (
    <div className="space-y-6">
      <Message msg={msg} />

      {/* Liste */}
      <div className="space-y-2">
        {depts.map((d) =>
          editId === d.id ? (
            <form
              key={d.id}
              onSubmit={(e) => handleUpdate(e, d.id)}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-md"
            >
              <input type="text" name="name" defaultValue={d.name} required className={inputCls + " flex-1"} />
              <input type="number" name="extraFee" defaultValue={d.extraFee} step="0.01" min="0" className={inputCls + " w-28"} />
              <span className="text-sm text-gray-500">EUR</span>
              <button type="submit" disabled={saving} className={btnPrimary}>OK</button>
              <button type="button" onClick={() => setEditId(null)} className={btnSecondary}>Abbrechen</button>
            </form>
          ) : (
            <div key={d.id} className={`flex items-center justify-between p-3 rounded-md border ${d.isActive ? "bg-white border-gray-200" : "bg-gray-100 border-gray-200 opacity-60"}`}>
              <div>
                <span className="font-medium">{d.name}</span>
                {d.extraFee > 0 && (
                  <span className="ml-2 text-sm text-gray-500">+{d.extraFee.toFixed(2)} EUR</span>
                )}
                {!d.isActive && <span className="ml-2 text-xs text-red-500">(deaktiviert)</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditId(d.id)} className={btnSecondary}>Bearbeiten</button>
                <button
                  onClick={() => handleToggle(d.id, d.isActive)}
                  className={btnSecondary}
                >
                  {d.isActive ? "Deaktivieren" : "Aktivieren"}
                </button>
              </div>
            </div>
          ),
        )}
        {depts.length === 0 && <p className="text-sm text-gray-500">Noch keine Sparten angelegt.</p>}
      </div>

      {/* Neue Sparte */}
      <form onSubmit={handleAdd} className="flex items-end gap-3 pt-4 border-t">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Neue Sparte</label>
          <input type="text" name="name" placeholder="Name" required className={inputCls} />
        </div>
        <div className="w-28">
          <label className="block text-sm font-medium text-gray-700 mb-1">Zusatzbeitrag</label>
          <input type="number" name="extraFee" defaultValue="0" step="0.01" min="0" className={inputCls} />
        </div>
        <button type="submit" disabled={saving} className={btnPrimary}>Hinzufuegen</button>
      </form>
    </div>
  );
}

// ─── Tab 3: Mitgliedstypen ───

function MitgliedstypenTab({ membershipTypes: initial }: { membershipTypes: MembershipTypeRow[] }) {
  const router = useRouter();
  const [types, setTypes] = useState(initial);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      const result = await trpcMutate("settings.createMembershipType", {
        name: fd.get("name") as string,
        fee: Number(fd.get("fee")) || 0,
      });
      setTypes((prev) => [...prev, { ...result, fee: Number(result.fee) }]);
      setMsg({ type: "success", text: "Mitgliedstyp angelegt" });
      e.currentTarget.reset();
      router.refresh();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      await trpcMutate("settings.updateMembershipType", {
        id,
        name: fd.get("name") as string,
        fee: Number(fd.get("fee")) || 0,
      });
      setTypes((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, name: fd.get("name") as string, fee: Number(fd.get("fee")) || 0 } : t,
        ),
      );
      setEditId(null);
      setMsg({ type: "success", text: "Mitgliedstyp aktualisiert" });
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    setMsg(null);
    try {
      await trpcMutate("settings.toggleMembershipType", { id, isActive: !isActive });
      setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, isActive: !isActive } : t)));
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    }
  }

  return (
    <div className="space-y-6">
      <Message msg={msg} />

      <div className="space-y-2">
        {types.map((t) =>
          editId === t.id ? (
            <form
              key={t.id}
              onSubmit={(e) => handleUpdate(e, t.id)}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-md"
            >
              <input type="text" name="name" defaultValue={t.name} required className={inputCls + " flex-1"} />
              <input type="number" name="fee" defaultValue={t.fee} step="0.01" min="0" className={inputCls + " w-28"} />
              <span className="text-sm text-gray-500">EUR</span>
              <button type="submit" disabled={saving} className={btnPrimary}>OK</button>
              <button type="button" onClick={() => setEditId(null)} className={btnSecondary}>Abbrechen</button>
            </form>
          ) : (
            <div key={t.id} className={`flex items-center justify-between p-3 rounded-md border ${t.isActive ? "bg-white border-gray-200" : "bg-gray-100 border-gray-200 opacity-60"}`}>
              <div>
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-sm text-gray-500">{t.fee.toFixed(2)} EUR/Monat</span>
                {!t.isActive && <span className="ml-2 text-xs text-red-500">(deaktiviert)</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditId(t.id)} className={btnSecondary}>Bearbeiten</button>
                <button onClick={() => handleToggle(t.id, t.isActive)} className={btnSecondary}>
                  {t.isActive ? "Deaktivieren" : "Aktivieren"}
                </button>
              </div>
            </div>
          ),
        )}
        {types.length === 0 && <p className="text-sm text-gray-500">Noch keine Mitgliedstypen angelegt.</p>}
      </div>

      <form onSubmit={handleAdd} className="flex items-end gap-3 pt-4 border-t">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Neuer Mitgliedstyp</label>
          <input type="text" name="name" placeholder="Name" required className={inputCls} />
        </div>
        <div className="w-28">
          <label className="block text-sm font-medium text-gray-700 mb-1">Beitrag</label>
          <input type="number" name="fee" defaultValue="0" step="0.01" min="0" className={inputCls} />
        </div>
        <button type="submit" disabled={saving} className={btnPrimary}>Hinzufuegen</button>
      </form>
    </div>
  );
}

// ─── Tab 4: Zahlungsoptionen ───

function ZahlungsoptionenTab({ settings }: { settings: VereinsBuddySettings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const intervalle = ["monatlich", "vierteljaehrlich", "halbjaehrlich", "jaehrlich"] as const;
  const intervallLabels: Record<string, string> = {
    monatlich: "Monatlich",
    vierteljaehrlich: "Vierteljaehrlich",
    halbjaehrlich: "Halbjaehrlich",
    jaehrlich: "Jaehrlich",
  };

  type Intervall = (typeof intervalle)[number];

  function toggleIntervall(v: Intervall) {
    setS((prev) => ({
      ...prev,
      zahlungsintervalle: prev.zahlungsintervalle.includes(v)
        ? prev.zahlungsintervalle.filter((i): i is Intervall => i !== v)
        : [...prev.zahlungsintervalle, v],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await trpcMutate("settings.updateSettings", s);
      setMsg({ type: "success", text: "Zahlungsoptionen gespeichert" });
      router.refresh();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Message msg={msg} />

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Zahlungsintervalle</h3>
        <div className="space-y-2">
          {intervalle.map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={s.zahlungsintervalle.includes(v)}
                onChange={() => toggleIntervall(v)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{intervallLabels[v]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Aufnahmegebuehr</h3>
        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={s.aufnahmegebuehr.aktiv}
            onChange={() => setS((p) => ({ ...p, aufnahmegebuehr: { ...p.aufnahmegebuehr, aktiv: !p.aufnahmegebuehr.aktiv } }))}
            className="rounded border-gray-300"
          />
          <span className="text-sm">Aufnahmegebuehr erheben</span>
        </label>
        {s.aufnahmegebuehr.aktiv && (
          <div className="flex items-center gap-2 ml-6">
            <input
              type="number"
              value={s.aufnahmegebuehr.betrag}
              onChange={(e) => setS((p) => ({ ...p, aufnahmegebuehr: { ...p.aufnahmegebuehr, betrag: Number(e.target.value) || 0 } }))}
              step="0.01"
              min="0"
              className={inputCls + " w-28"}
            />
            <span className="text-sm text-gray-500">EUR</span>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">SEPA-Lastschrift</h3>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={s.sepa_aktiv}
            onChange={() => setS((p) => ({ ...p, sepa_aktiv: !p.sepa_aktiv }))}
            className="rounded border-gray-300"
          />
          <span className="text-sm">SEPA-Lastschrift als Zahlungsmethode anbieten</span>
        </label>
        {s.sepa_aktiv && (
          <div className="ml-6 mt-3 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Glaeubiger-Identifikationsnummer</label>
              <input
                type="text"
                value={s.sepa_glaeubiger_id}
                onChange={(e) => setS((p) => ({ ...p, sepa_glaeubiger_id: e.target.value }))}
                placeholder="DE98ZZZ09999999999"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pre-Notification Frist (Tage)</label>
              <input
                type="number"
                value={s.sepa_pre_notification}
                onChange={(e) => setS((p) => ({ ...p, sepa_pre_notification: Number(e.target.value) || 14 }))}
                min="1"
                className={inputCls + " w-24"}
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Weitere Zahlungsarten</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.zahlungsarten.ueberweisung}
              onChange={() => setS((p) => ({ ...p, zahlungsarten: { ...p.zahlungsarten, ueberweisung: !p.zahlungsarten.ueberweisung } }))}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Ueberweisung</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.zahlungsarten.bar}
              onChange={() => setS((p) => ({ ...p, zahlungsarten: { ...p.zahlungsarten, bar: !p.zahlungsarten.bar } }))}
              className="rounded border-gray-300"
            />
            <span className="text-sm">Barzahlung</span>
          </label>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className={btnPrimary}>
        {saving ? "Speichert..." : "Speichern"}
      </button>
    </div>
  );
}

// ─── Tab 5: Optionale Felder ───

function OptionaleFelderTab({ settings }: { settings: VereinsBuddySettings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function toggleField(field: keyof VereinsBuddySettings["optionale_felder"]) {
    setS((prev) => ({
      ...prev,
      optionale_felder: {
        ...prev.optionale_felder,
        [field]: !prev.optionale_felder[field],
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await trpcMutate("settings.updateSettings", s);
      setMsg({ type: "success", text: "Optionale Felder gespeichert" });
      router.refresh();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Message msg={msg} />
      <p className="text-sm text-gray-500">Bestimme welche optionalen Felder im Mitgliedsantrag angezeigt werden.</p>
      <div className="space-y-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.optionale_felder.telefon} onChange={() => toggleField("telefon")} className="rounded border-gray-300" />
          <span className="text-sm">Telefonnummer</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.optionale_felder.notfallkontakt} onChange={() => toggleField("notfallkontakt")} className="rounded border-gray-300" />
          <span className="text-sm">Notfallkontakt</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.optionale_felder.fotoerlaubnis} onChange={() => toggleField("fotoerlaubnis")} className="rounded border-gray-300" />
          <span className="text-sm">Fotoerlaubnis — Einwilligung zur Veroeffentlichung von Fotos</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.optionale_felder.newsletter} onChange={() => toggleField("newsletter")} className="rounded border-gray-300" />
          <span className="text-sm">Newsletter — Vereinsnewsletter per E-Mail</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.optionale_felder.ehrenamt} onChange={() => toggleField("ehrenamt")} className="rounded border-gray-300" />
          <span className="text-sm">Ehrenamt — Interesse an ehrenamtlicher Mitarbeit</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.optionale_felder.spende} onChange={() => toggleField("spende")} className="rounded border-gray-300" />
          <span className="text-sm">Spende — Freiwilliger Foerderbeitrag</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.optionale_felder.mitglied_wirbt} onChange={() => toggleField("mitglied_wirbt")} className="rounded border-gray-300" />
          <span className="text-sm">Mitglied wirbt Mitglied — Werbername fuer Praemien</span>
        </label>
      </div>

      <h3 className="text-sm font-medium text-gray-700 mt-6 mb-3">Foto-Upload</h3>
      <select
        value={s.foto_upload}
        onChange={(e) => setS((p) => ({ ...p, foto_upload: e.target.value as "aus" | "optional" | "pflicht" }))}
        className={inputCls + " w-48"}
      >
        <option value="aus">Aus</option>
        <option value="optional">Optional</option>
        <option value="pflicht">Pflicht</option>
      </select>

      <h3 className="text-sm font-medium text-gray-700 mt-6 mb-3">Familienmitgliedschaft</h3>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={s.familienmitgliedschaft}
          onChange={() => setS((p) => ({ ...p, familienmitgliedschaft: !p.familienmitgliedschaft }))}
          className="rounded border-gray-300"
        />
        <span className="text-sm">Familienmitgliedschaft anbieten — mehrere Personen in einem Antrag</span>
      </label>

      <button onClick={handleSave} disabled={saving} className={btnPrimary}>
        {saving ? "Speichert..." : "Speichern"}
      </button>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Datenimport</h3>
        <Link href="/admin/einstellungen/import" className="text-sm text-blue-600 hover:text-blue-800">
          CSV-Import fuer Bestandsmitglieder →
        </Link>
      </div>
    </div>
  );
}

// ─── Tab 6: Dokumente ───

function DokumenteTab({ settings }: { settings: VereinsBuddySettings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleUpload(docType: "satzung" | "beitragsordnung", file: File) {
    setUploading(docType);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", docType);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen");
      const urlKey = `${docType}_url` as "satzung_url" | "beitragsordnung_url";
      const typKey = `${docType}_typ` as "satzung_typ" | "beitragsordnung_typ";
      setS((prev) => ({ ...prev, [urlKey]: data.path, [typKey]: "upload" as const }));
      setMsg({ type: "success", text: `${docType === "satzung" ? "Satzung" : "Beitragsordnung"} hochgeladen` });
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Upload-Fehler" });
    } finally {
      setUploading(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await trpcMutate("settings.updateSettings", s);
      setMsg({ type: "success", text: "Dokumente gespeichert" });
      router.refresh();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  function DocSection({ label, docType }: { label: string; docType: "satzung" | "beitragsordnung" }) {
    const urlKey = `${docType}_url` as "satzung_url" | "beitragsordnung_url";
    const typKey = `${docType}_typ` as "satzung_typ" | "beitragsordnung_typ";
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">{label}</h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={s[typKey] === "url"}
              onChange={() => setS((p) => ({ ...p, [typKey]: "url" as const }))}
            />
            <span className="text-sm">URL</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={s[typKey] === "upload"}
              onChange={() => setS((p) => ({ ...p, [typKey]: "upload" as const }))}
            />
            <span className="text-sm">PDF hochladen</span>
          </label>
        </div>
        {s[typKey] === "url" ? (
          <input
            type="url"
            value={s[urlKey]}
            onChange={(e) => setS((p) => ({ ...p, [urlKey]: e.target.value }))}
            placeholder="https://..."
            className={inputCls}
          />
        ) : (
          <div>
            {s[urlKey] && <p className="text-sm text-gray-500 mb-1">Aktuell: {s[urlKey]}</p>}
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => e.target.files?.[0] && handleUpload(docType, e.target.files[0])}
              disabled={uploading === docType}
              className="text-sm text-gray-500"
            />
            {uploading === docType && <p className="text-sm text-gray-500 mt-1">Wird hochgeladen...</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Message msg={msg} />
      <DocSection label="Satzung" docType="satzung" />
      <DocSection label="Beitragsordnung" docType="beitragsordnung" />
      <button onClick={handleSave} disabled={saving} className={btnPrimary}>
        {saving ? "Speichert..." : "Speichern"}
      </button>
    </div>
  );
}

// ─── Tab 7: Impressum ───

function ImpressumTab({ settings }: { settings: VereinsBuddySettings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await trpcMutate("settings.updateSettings", s);
      setMsg({ type: "success", text: "Impressum gespeichert" });
      router.refresh();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Message msg={msg} />
      <p className="text-sm text-gray-500">Impressum-Angaben fuer die Subdomain deines Vereins.</p>
      <textarea
        value={s.impressum}
        onChange={(e) => setS((p) => ({ ...p, impressum: e.target.value }))}
        rows={8}
        placeholder="Vereinsname&#10;Strasse Nr.&#10;PLZ Ort&#10;Vertretungsberechtigter: ..."
        className={inputCls}
      />
      <button onClick={handleSave} disabled={saving} className={btnPrimary}>
        {saving ? "Speichert..." : "Speichern"}
      </button>
    </div>
  );
}

// ─── Tab 8: E-Mail-Vorlagen ───

const TEMPLATE_KEYS = [
  { key: "member_confirm", label: "Eingangsbestaetigung (an Antragsteller)" },
  { key: "admin_notify", label: "Neue-Antrag-Notification (an Admin)" },
  { key: "member_welcome", label: "Aufnahmebestaetigung / Willkommen" },
  { key: "member_reject", label: "Ablehnung" },
] as const;

const PLACEHOLDER_HELP = "{vereinsname}, {vorname}, {nachname}, {mitgliedsname}, {mitgliedsnummer}, {beitrag}, {zahlungsweise}, {intervall}, {sparten}, {eintrittsdatum}, {ablehnungsgrund}";

function EmailVorlagenTab() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Record<string, { subject: string; body: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/trpc/settings.listEmailTemplates");
        const data = await res.json();
        const items = data?.result?.data?.json ?? data?.result?.data ?? [];
        const map: Record<string, { subject: string; body: string }> = {};
        for (const t of items as { templateKey: string; subject: string; body: string }[]) {
          map[t.templateKey] = { subject: t.subject, body: t.body };
        }
        setTemplates(map);
      } catch { /* defaults */ }
      setLoaded(true);
    })();
  }, []);

  function getT(key: string) {
    return templates[key] ?? EMAIL_DEFAULTS[key] ?? { subject: "", body: "" };
  }
  function isCustom(key: string) { return !!templates[key]; }
  function setT(key: string, field: "subject" | "body", value: string) {
    setTemplates((p) => ({ ...p, [key]: { ...getT(key), [field]: value } }));
  }

  async function save(key: string) {
    setSavingKey(key); setMsg(null);
    try {
      await trpcMutate("settings.updateEmailTemplate", { templateKey: key, ...getT(key) });
      setMsg({ type: "success", text: "Vorlage gespeichert" }); router.refresh();
    } catch (err) { setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" }); }
    finally { setSavingKey(null); }
  }

  async function reset(key: string) {
    setSavingKey(key); setMsg(null);
    try {
      await trpcMutate("settings.resetEmailTemplate", { templateKey: key });
      setTemplates((p) => { const n = { ...p }; delete n[key]; return n; });
      setMsg({ type: "success", text: "Auf Standard zurueckgesetzt" }); router.refresh();
    } catch (err) { setMsg({ type: "error", text: err instanceof Error ? err.message : "Fehler" }); }
    finally { setSavingKey(null); }
  }

  if (!loaded) return <p className="text-sm text-gray-500">Laden...</p>;

  return (
    <div className="space-y-8">
      <Message msg={msg} />
      <p className="text-sm text-gray-500">
        Passe die E-Mail-Vorlagen an. Platzhalter: <code className="text-xs bg-gray-100 px-1 rounded">{PLACEHOLDER_HELP}</code>
      </p>
      {TEMPLATE_KEYS.map(({ key, label }) => {
        const t = getT(key);
        return (
          <div key={key} className="border border-gray-200 rounded-md p-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
              {!isCustom(key) && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Standard</span>}
              {isCustom(key) && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Angepasst</span>}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Betreff</label>
                <input type="text" value={t.subject} onChange={(e) => setT(key, "subject", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Inhalt</label>
                <textarea value={t.body} onChange={(e) => setT(key, "body", e.target.value)} rows={6} className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => save(key)} disabled={savingKey === key} className={btnPrimary}>
                  {savingKey === key ? "Speichert..." : "Speichern"}
                </button>
                <button onClick={() => reset(key)} disabled={savingKey === key} className={btnSecondary}>
                  Auf Standard zuruecksetzen
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
