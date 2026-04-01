/**
 * Default E-Mail-Vorlagen fuer VereinsBuddy.
 * Werden als Fallback genutzt wenn kein DB-Template existiert.
 */

export type EmailTemplateDefault = {
  subject: string;
  body: string;
};

export const EMAIL_DEFAULTS: Record<string, EmailTemplateDefault> = {
  member_confirm: {
    subject: "Dein Mitgliedsantrag bei {vereinsname}",
    body: `Hallo {vorname} {nachname},

vielen Dank fuer deinen Mitgliedsantrag beim {vereinsname}.

Deine Daten wurden uebermittelt. Die Aufnahme erfolgt nach Pruefung durch den Vorstand. Du erhaeltst eine weitere Nachricht sobald ueber deinen Antrag entschieden wurde.

Diese E-Mail wurde automatisch versendet.`,
  },

  admin_notify: {
    subject: "Neuer Mitgliedsantrag: {vorname} {nachname}",
    body: `Beim {vereinsname} ist ein neuer Mitgliedsantrag eingegangen:

Name: {vorname} {nachname}
E-Mail: {email}
Status: eingegangen

Bitte pruefe den Antrag im Admin-Bereich.`,
  },

  member_welcome: {
    subject: "Willkommen im {vereinsname}!",
    body: `Hallo {vorname} {nachname},

dein Mitgliedsantrag wurde angenommen!

Mitgliedsnummer: {mitgliedsnummer}
Beitrag: {beitrag}
Zahlungsintervall: {intervall}
Zahlungsweise: {zahlungsweise}

Bei Fragen wende dich bitte an deinen Verein.

Diese E-Mail wurde automatisch versendet.`,
  },

  member_reject: {
    subject: "Dein Mitgliedsantrag bei {vereinsname}",
    body: `Hallo {vorname} {nachname},

leider muessen wir dir mitteilen, dass dein Mitgliedsantrag beim {vereinsname} nicht angenommen wurde.

{ablehnungsgrund}

Bei Fragen wende dich bitte an den Verein.

Diese E-Mail wurde automatisch versendet.`,
  },
};

/** Alle verfuegbaren Platzhalter mit Beschreibung */
export const PLACEHOLDERS = [
  { key: "{vereinsname}", label: "Vereinsname" },
  { key: "{vorname}", label: "Vorname" },
  { key: "{nachname}", label: "Nachname" },
  { key: "{mitgliedsname}", label: "Vor- und Nachname" },
  { key: "{email}", label: "E-Mail-Adresse" },
  { key: "{mitgliedsnummer}", label: "Mitgliedsnummer" },
  { key: "{beitrag}", label: "Beitrag" },
  { key: "{zahlungsweise}", label: "Zahlungsweise" },
  { key: "{intervall}", label: "Zahlungsintervall" },
  { key: "{sparten}", label: "Sparten/Abteilungen" },
  { key: "{eintrittsdatum}", label: "Eintrittsdatum" },
  { key: "{ablehnungsgrund}", label: "Ablehnungsgrund (nur bei Ablehnung)" },
];
