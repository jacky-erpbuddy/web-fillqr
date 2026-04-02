"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="fq-auth"><div className="fq-auth__card"><p>Laden...</p></div></div>}>
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!token) {
    return (
      <div className="fq-auth">
        <div className="fq-auth__card">
          <h1 className="fq-auth__title">Ungueltiger Link</h1>
          <p className="fq-auth__subtitle">
            Dieser Link ist ungueltig. Bitte kontaktiere den Support.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fq-auth">
        <div className="fq-auth__card">
          <h1 className="fq-auth__title">Passwort gesetzt!</h1>
          <p className="fq-auth__subtitle">
            Du kannst dich jetzt anmelden.
          </p>
          <a href="/login" className="fq-btn fq-btn--gradient" style={{ display: "block" }}>
            Zur Anmeldung
          </a>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    if (password !== confirm) {
      setError("Passwoerter stimmen nicht ueberein.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Fehler beim Setzen des Passworts.");
        setSaving(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
      setSaving(false);
    }
  }

  return (
    <div className="fq-auth">
      <div className="fq-auth__card">
        <h1 className="fq-auth__title">Passwort setzen</h1>
        <p className="fq-auth__subtitle">
          Waehle ein Passwort fuer deinen fillQR-Zugang.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className="fq-auth__error">{error}</div>}

          <div className="fq-field">
            <label htmlFor="password" className="fq-label">Neues Passwort</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="fq-input"
            />
          </div>

          <div className="fq-field">
            <label htmlFor="confirm" className="fq-label">Passwort bestaetigen</label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="fq-input"
            />
          </div>

          <button type="submit" disabled={saving} className="fq-btn fq-btn--gradient">
            {saving ? "Wird gespeichert..." : "Passwort setzen"}
          </button>
        </form>
      </div>
    </div>
  );
}
