"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Anmeldung fehlgeschlagen");
        return;
      }

      router.push("/admin/dashboard");
      router.refresh();
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px" }}>
      <h1 style={{ marginBottom: 24 }}>fillQR Admin</h1>
      <form onSubmit={handleSubmit}>
        {error && (
          <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>
        )}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="email"
            style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
          >
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
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
            htmlFor="password"
            style={{ display: "block", marginBottom: 4, fontWeight: 500 }}
          >
            Passwort
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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
          disabled={submitting}
          style={{
            width: "100%",
            padding: "10px 16px",
            backgroundColor: submitting ? "#93c5fd" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontSize: 16,
            cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "Wird angemeldet..." : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
