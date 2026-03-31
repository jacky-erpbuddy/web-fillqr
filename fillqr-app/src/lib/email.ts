import nodemailer from "nodemailer";

/** HTML-Escape fuer Platzhalter in E-Mail-Templates (XSS-Schutz) */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@fillqr.de",
    to,
    subject,
    html,
  });
}

export function buildInviteEmail(link: string): { subject: string; html: string } {
  return {
    subject: "Dein fillQR-Zugang ist bereit!",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Willkommen bei fillQR!</h2>
        <p>Dein Admin-Zugang wurde erstellt. Bitte setze jetzt dein Passwort:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Passwort setzen
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Dieser Link ist 48 Stunden gueltig. Falls du diese E-Mail nicht erwartet hast, kannst du sie ignorieren.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Oder kopiere diesen Link in deinen Browser:<br/>
          <a href="${link}" style="color: #2563eb;">${link}</a>
        </p>
      </div>
    `,
  };
}

export function buildMemberConfirmEmail(tenantName: string): {
  subject: string;
  html: string;
} {
  return {
    subject: `Dein Mitgliedsantrag bei ${tenantName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Vielen Dank fuer deinen Antrag!</h2>
        <p>Deine Daten wurden an den <strong>${tenantName}</strong> uebermittelt.</p>
        <p>Die Aufnahme erfolgt nach Pruefung durch den Vorstand. Du erhaeltst eine weitere Nachricht sobald ueber deinen Antrag entschieden wurde.</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          Diese E-Mail wurde automatisch versendet. Bitte antworte nicht auf diese Nachricht.
        </p>
      </div>
    `,
  };
}

export function buildMemberNotifyEmail(
  tenantName: string,
  firstName: string,
  lastName: string,
  email: string,
): { subject: string; html: string } {
  return {
    subject: `Neuer Mitgliedsantrag: ${firstName} ${lastName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Neuer Mitgliedsantrag</h2>
        <p>Bei <strong>${tenantName}</strong> ist ein neuer Antrag eingegangen:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Name:</td><td>${firstName} ${lastName}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">E-Mail:</td><td>${email}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Status:</td><td>eingegangen</td></tr>
        </table>
        <p>Bitte pruefe den Antrag im Admin-Bereich.</p>
      </div>
    `,
  };
}

export function buildWelcomeEmail(params: {
  tenantName: string;
  firstName: string;
  lastName: string;
  memberNo: number;
  fee: string;
  interval: string;
  paymentMethod: string;
}): { subject: string; html: string } {
  const { tenantName, firstName, lastName, memberNo, fee, interval, paymentMethod } = params;
  return {
    subject: `Willkommen im ${tenantName}!`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Willkommen im ${esc(tenantName)}!</h2>
        <p>Hallo ${esc(firstName)} ${esc(lastName)},</p>
        <p>dein Mitgliedsantrag wurde angenommen. Hier deine Daten im Ueberblick:</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Mitgliedsnummer:</td><td><strong>${memberNo}</strong></td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Beitrag:</td><td>${esc(fee)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Zahlungsintervall:</td><td>${esc(interval)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Zahlungsweise:</td><td>${esc(paymentMethod)}</td></tr>
        </table>
        <p>Bei Fragen wende dich bitte an deinen Verein.</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          Diese E-Mail wurde automatisch versendet. Bitte antworte nicht auf diese Nachricht.
        </p>
      </div>
    `,
  };
}

export function buildResetEmail(link: string): { subject: string; html: string } {
  return {
    subject: "fillQR — Passwort zuruecksetzen",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Passwort zuruecksetzen</h2>
        <p>Du hast angefordert, dein Passwort zurueckzusetzen. Klicke auf den Button:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            Neues Passwort setzen
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Dieser Link ist 1 Stunde gueltig. Falls du kein neues Passwort angefordert hast, kannst du diese E-Mail ignorieren.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Oder kopiere diesen Link in deinen Browser:<br/>
          <a href="${link}" style="color: #2563eb;">${link}</a>
        </p>
      </div>
    `,
  };
}
