import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px" }}>
      <h1 style={{ marginBottom: 24 }}>fillQR Admin</h1>
      <LoginForm searchParams={searchParams} />
    </div>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;

  return (
    <form action={login}>
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
          name="email"
          type="email"
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
          name="password"
          type="password"
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
        style={{
          width: "100%",
          padding: "10px 16px",
          backgroundColor: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 6,
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        Anmelden
      </button>
    </form>
  );
}
