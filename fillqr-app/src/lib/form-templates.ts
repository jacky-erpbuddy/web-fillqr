/**
 * Vorgefertigte Formular-Templates fuer die 3 V1 Use Cases.
 * Eigene Typen — nicht an UI-State gekoppelt.
 */

export type FormTemplateField = {
  key: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "SELECT" | "CHECKBOX" | "DATE";
  required: boolean;
  sortOrder: number;
  config: { options: string[] } | null;
};

export type FormTemplate = {
  id: string;
  label: string;
  title: string;
  type: "VEREIN" | "FEEDBACK" | "LEAD";
  fields: FormTemplateField[];
};

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "verein",
    label: "Verein — Mitgliedsantrag",
    title: "Mitgliedsantrag",
    type: "VEREIN",
    fields: [
      { key: "vorname", label: "Vorname", type: "TEXT", required: true, sortOrder: 0, config: null },
      { key: "nachname", label: "Nachname", type: "TEXT", required: true, sortOrder: 1, config: null },
      { key: "email", label: "E-Mail", type: "EMAIL", required: true, sortOrder: 2, config: null },
      { key: "telefon", label: "Telefon", type: "PHONE", required: false, sortOrder: 3, config: null },
      { key: "geburtsdatum", label: "Geburtsdatum", type: "DATE", required: false, sortOrder: 4, config: null },
      { key: "strasse", label: "Straße", type: "TEXT", required: false, sortOrder: 5, config: null },
      { key: "plz", label: "PLZ", type: "TEXT", required: false, sortOrder: 6, config: null },
      { key: "ort", label: "Ort", type: "TEXT", required: false, sortOrder: 7, config: null },
      { key: "mitgliedstyp", label: "Mitgliedstyp", type: "SELECT", required: false, sortOrder: 8, config: { options: ["Aktiv", "Passiv", "Jugend", "Familie"] } },
      { key: "datenschutz_akzeptiert", label: "Datenschutz akzeptiert", type: "CHECKBOX", required: true, sortOrder: 9, config: null },
    ],
  },
  {
    id: "feedback",
    label: "Feedback — Trainer / Schulung",
    title: "Trainerfeedback",
    type: "FEEDBACK",
    fields: [
      { key: "name", label: "Name", type: "TEXT", required: false, sortOrder: 0, config: null },
      { key: "email", label: "E-Mail", type: "EMAIL", required: false, sortOrder: 1, config: null },
      { key: "bewertung", label: "Bewertung", type: "SELECT", required: true, sortOrder: 2, config: { options: ["1 - Sehr schlecht", "2 - Schlecht", "3 - Okay", "4 - Gut", "5 - Sehr gut"] } },
      { key: "was_lief_gut", label: "Was lief gut?", type: "TEXTAREA", required: false, sortOrder: 3, config: null },
      { key: "was_besser", label: "Was kann besser werden?", type: "TEXTAREA", required: false, sortOrder: 4, config: null },
      { key: "kommentar", label: "Kommentar", type: "TEXTAREA", required: false, sortOrder: 5, config: null },
    ],
  },
  {
    id: "lead",
    label: "Lead — Messe / Kontakt",
    title: "Kontaktformular Messe",
    type: "LEAD",
    fields: [
      { key: "vorname", label: "Vorname", type: "TEXT", required: true, sortOrder: 0, config: null },
      { key: "nachname", label: "Nachname", type: "TEXT", required: true, sortOrder: 1, config: null },
      { key: "firma", label: "Firma", type: "TEXT", required: false, sortOrder: 2, config: null },
      { key: "email", label: "E-Mail", type: "EMAIL", required: true, sortOrder: 3, config: null },
      { key: "telefon", label: "Telefon", type: "PHONE", required: false, sortOrder: 4, config: null },
      { key: "interesse", label: "Interesse", type: "SELECT", required: false, sortOrder: 5, config: { options: ["Produkt A", "Produkt B", "Partnerschaft", "Sonstiges"] } },
      { key: "nachricht", label: "Nachricht", type: "TEXTAREA", required: false, sortOrder: 6, config: null },
      { key: "datenschutz_akzeptiert", label: "Datenschutz akzeptiert", type: "CHECKBOX", required: true, sortOrder: 7, config: null },
    ],
  },
];
