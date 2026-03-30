import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = params.error;

  // Host-Check: Betreiber-Host → nur Passwort, sonst → E-Mail + Passwort
  const headersList = await headers();
  const isBetreiber = headersList.get("x-betreiber") === "true";

  if (isBetreiber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Betreiber-Panel
          </h1>
          <p className="text-sm text-gray-500 mb-6">fillQR Administration</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <form action="/api/auth/betreiber-login" method="POST">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Passwort
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              className="mt-4 w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Anmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Kunden-Login (bestehend)
  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "0 20px" }}>
      <h1 style={{ marginBottom: 24 }}>fillQR Admin</h1>
      <form action="/api/auth/login" method="POST">
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

        <p style={{ marginTop: 16, textAlign: "center" }}>
          <a
            href="/forgot-password"
            style={{ color: "#2563eb", textDecoration: "underline", fontSize: 14 }}
          >
            Passwort vergessen?
          </a>
        </p>
      </form>
    </div>
  );
}
