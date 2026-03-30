"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (sent) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px" }}>
        <h1 style={{ marginBottom: 16 }}>E-Mail gesendet</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          Wenn ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir
          einen Link zum Zuruecksetzen deines Passworts gesendet.
        </p>
        <a
          href="/login"
          style={{ color: "#2563eb", textDecoration: "underline" }}
        >
          Zurueck zur Anmeldung
        </a>
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
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px" }}>
      <h1 style={{ marginBottom: 8 }}>Passwort vergessen?</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum
        Zuruecksetzen deines Passworts.
      </p>

      <form onSubmit={handleSubmit}>
        {error && (
          <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>
        )}

        <div style={{ marginBottom: 24 }}>
          <label
            htmlFor="email"
            style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
          >
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 16,
            }}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            width: "100%",
            padding: "10px 16px",
            backgroundColor: saving ? "#93c5fd" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Wird gesendet..." : "Link senden"}
        </button>

        <p style={{ marginTop: 16, textAlign: "center" }}>
          <a
            href="/login"
            style={{ color: "#2563eb", textDecoration: "underline", fontSize: 14 }}
          >
            Zurueck zur Anmeldung
          </a>
        </p>
      </form>
    </div>
  );
}
