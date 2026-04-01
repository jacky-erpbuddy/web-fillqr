import { z } from "zod";

/**
 * Zod-Schema fuer tbl_tenant_apps.settings_json (VereinsBuddy).
 * Wird serverseitig validiert bei jedem Update.
 */
export const vereinsbuddySettingsSchema = z.object({
  zahlungsintervalle: z
    .array(z.enum(["monatlich", "vierteljaehrlich", "halbjaehrlich", "jaehrlich"]))
    .default([]),
  aufnahmegebuehr: z
    .object({
      aktiv: z.boolean().default(false),
      betrag: z.number().min(0).default(0),
    })
    .default({ aktiv: false, betrag: 0 }),
  sepa_aktiv: z.boolean().default(false),
  sepa_glaeubiger_id: z.string().default(""),
  sepa_pre_notification: z.number().min(1).default(14),
  zahlungsarten: z
    .object({
      ueberweisung: z.boolean().default(true),
      bar: z.boolean().default(false),
    })
    .default({ ueberweisung: true, bar: false }),
  optionale_felder: z
    .object({
      telefon: z.boolean().default(false),
      notfallkontakt: z.boolean().default(false),
      fotoerlaubnis: z.boolean().default(false),
      newsletter: z.boolean().default(false),
      ehrenamt: z.boolean().default(false),
      spende: z.boolean().default(false),
      mitglied_wirbt: z.boolean().default(false),
    })
    .default({ telefon: false, notfallkontakt: false, fotoerlaubnis: false, newsletter: false, ehrenamt: false, spende: false, mitglied_wirbt: false }),
  foto_upload: z.enum(["aus", "optional", "pflicht"]).default("aus"),
  familienmitgliedschaft: z.boolean().default(false),
  satzung_url: z.string().default(""),
  satzung_typ: z.enum(["url", "upload"]).default("url"),
  beitragsordnung_url: z.string().default(""),
  beitragsordnung_typ: z.enum(["url", "upload"]).default("url"),
  impressum: z.string().default(""),
});

export type VereinsBuddySettings = z.infer<typeof vereinsbuddySettingsSchema>;

/** Default-Werte fuer neue TenantApps */
export const DEFAULT_SETTINGS: VereinsBuddySettings = {
  zahlungsintervalle: [],
  aufnahmegebuehr: { aktiv: false, betrag: 0 },
  sepa_aktiv: false,
  sepa_glaeubiger_id: "",
  sepa_pre_notification: 14,
  zahlungsarten: { ueberweisung: true, bar: false },
  optionale_felder: { telefon: false, notfallkontakt: false, fotoerlaubnis: false, newsletter: false, ehrenamt: false, spende: false, mitglied_wirbt: false },
  foto_upload: "aus",
  familienmitgliedschaft: false,
  satzung_url: "",
  satzung_typ: "url",
  beitragsordnung_url: "",
  beitragsordnung_typ: "url",
  impressum: "",
};

/** Parse settings_json mit Fallback auf Defaults */
export function parseSettings(raw: unknown): VereinsBuddySettings {
  const result = vereinsbuddySettingsSchema.safeParse(raw ?? {});
  return result.success ? result.data : DEFAULT_SETTINGS;
}
