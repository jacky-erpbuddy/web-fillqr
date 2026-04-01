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

// ─── Template-basierte E-Mails (AP-24) ───

import { EMAIL_DEFAULTS } from "./email-defaults";
import type { PrismaClient } from "@/generated/prisma/client";

/** Platzhalter in Text ersetzen. Werte werden HTML-escaped (Finding 4: esc auf Werte, nicht Template). */
export function renderTemplate(
  template: { subject: string; body: string },
  vars: Record<string, string>,
): { subject: string; html: string } {
  let subject = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(vars)) {
    const escaped = esc(value);
    const placeholder = `{${key}}`;
    subject = subject.replaceAll(placeholder, value); // Subject: kein HTML
    body = body.replaceAll(placeholder, escaped); // Body: escaped
  }
  // Body in HTML-Wrapper
  const html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; white-space: pre-line;">${body}</div>`;
  return { subject, html };
}

/** Template aus DB laden, Fallback auf Default */
export async function loadTemplate(
  prisma: PrismaClient,
  tenantId: string,
  templateKey: string,
): Promise<{ subject: string; body: string }> {
  const dbTemplate = await prisma.emailTemplate.findUnique({
    where: { tenantId_appKey_templateKey: { tenantId, appKey: "vereinsbuddy", templateKey } },
    select: { subject: true, body: true },
  });
  if (dbTemplate) return dbTemplate;
  return EMAIL_DEFAULTS[templateKey] ?? { subject: "", body: "" };
}

/** Template laden + rendern + senden (Convenience-Funktion) */
export async function sendTemplatedMail(
  prisma: PrismaClient,
  tenantId: string,
  templateKey: string,
  to: string,
  vars: Record<string, string>,
): Promise<void> {
  const template = await loadTemplate(prisma, tenantId, templateKey);
  const { subject, html } = renderTemplate(template, vars);
  await sendMail(to, subject, html);
}

// ─── Legacy-Funktionen (fuer buildInviteEmail, buildResetEmail — nicht template-basiert) ───

/** @deprecated Nutze sendTemplatedMail() fuer member_confirm */
export function buildMemberConfirmEmail(tenantName: string) {
  return renderTemplate(EMAIL_DEFAULTS.member_confirm, { vereinsname: tenantName, vorname: "", nachname: "" });
}

/** @deprecated Nutze sendTemplatedMail() fuer admin_notify */
export function buildMemberNotifyEmail(tenantName: string, firstName: string, lastName: string, email: string) {
  return renderTemplate(EMAIL_DEFAULTS.admin_notify, { vereinsname: tenantName, vorname: firstName, nachname: lastName, email });
}

/** @deprecated Nutze sendTemplatedMail() fuer member_welcome */
export function buildWelcomeEmail(params: {
  tenantName: string; firstName: string; lastName: string; memberNo: number;
  fee: string; interval: string; paymentMethod: string;
}) {
  return renderTemplate(EMAIL_DEFAULTS.member_welcome, {
    vereinsname: params.tenantName, vorname: params.firstName, nachname: params.lastName,
    mitgliedsnummer: String(params.memberNo), beitrag: params.fee, intervall: params.interval, zahlungsweise: params.paymentMethod,
  });
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
