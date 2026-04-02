"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (sent) {
    return (
      <div className="fq-auth">
        <div className="fq-auth__card">
          <h1 className="fq-auth__title">E-Mail gesendet</h1>
          <p className="fq-auth__subtitle">
            Wenn ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir
            einen Link zum Zuruecksetzen deines Passworts gesendet.
          </p>
          <a href="/login" className="fq-btn fq-btn--primary" style={{ display: "block" }}>
            Zurueck zur Anmeldung
          </a>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (res.status === 429) {
        setError("Zu viele Anfragen. Bitte warte eine Stunde.");
        setSaving(false);
        return;
      }

      // Immer "gesendet" anzeigen (kein Account-Enumeration)
      setSent(true);
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
      setSaving(false);
    }
  }

  return (
    <div className="fq-auth">
      <div className="fq-auth__card">
        <h1 className="fq-auth__title">Passwort vergessen?</h1>
        <p className="fq-auth__subtitle">
          Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum
          Zuruecksetzen deines Passworts.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className="fq-auth__error">{error}</div>}

          <div className="fq-field">
            <label htmlFor="email" className="fq-label">E-Mail</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="fq-input"
            />
          </div>

          <button type="submit" disabled={saving} className="fq-btn fq-btn--gradient">
            {saving ? "Wird gesendet..." : "Link senden"}
          </button>

          <p className="fq-text-center">
            <a href="/login" className="fq-link">Zurueck zur Anmeldung</a>
          </p>
        </form>
      </div>
    </div>
  );
}
