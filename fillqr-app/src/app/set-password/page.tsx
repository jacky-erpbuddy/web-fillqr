"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function SetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!token) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px" }}>
        <h1 style={{ marginBottom: 16 }}>Ungueltiger Link</h1>
        <p style={{ color: "#6b7280" }}>
          Dieser Link ist ungueltig. Bitte kontaktiere den Support.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px" }}>
        <h1 style={{ marginBottom: 16, color: "#16a34a" }}>Passwort gesetzt!</h1>
        <p style={{ marginBottom: 24 }}>
          Du kannst dich jetzt anmelden.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            backgroundColor: "#2563eb",
            color: "white",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          Zur Anmeldung
        </a>
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
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px" }}>
      <h1 style={{ marginBottom: 8 }}>Passwort setzen</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Waehle ein Passwort fuer deinen fillQR-Zugang.
      </p>

      <form onSubmit={handleSubmit}>
        {error && (
          <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>
        )}

        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="password"
            style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
          >
            Neues Passwort
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 16,
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label
            htmlFor="confirm"
            style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
          >
            Passwort bestaetigen
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          {saving ? "Wird gespeichert..." : "Passwort setzen"}
        </button>
      </form>
    </div>
  );
}
