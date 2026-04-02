import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

  // Demo Auto-Login: Wenn Demo-Tenant → direkt zum Auto-Login redirect
  const tenantSlug = headersList.get("x-tenant-slug");
  if (tenantSlug === "demo") {
    redirect("/api/auth/demo-login?redirect=/admin/dashboard");
  }

  if (isBetreiber) {
    return (
      <div className="fq-auth">
        <div className="fq-auth__card">
          <h1 className="fq-auth__title">Betreiber-Panel</h1>
          <p className="fq-auth__subtitle">fillQR Administration</p>

          {error && <div className="fq-auth__error">{error}</div>}

          <form action="/api/auth/betreiber-login" method="POST">
            <div className="fq-field">
              <label htmlFor="password" className="fq-label">Passwort</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autoFocus
                className="fq-input"
              />
            </div>
            <button type="submit" className="fq-btn fq-btn--gradient">
              Anmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Kunden-Login
  return (
    <div className="fq-auth">
      <div className="fq-auth__card">
        <h1 className="fq-auth__title">fillQR Admin</h1>
        <p className="fq-auth__subtitle">Melde dich an, um dein Dashboard zu verwalten.</p>

        {error && <div className="fq-auth__error">{error}</div>}

        <form action="/api/auth/login" method="POST">
          <div className="fq-field">
            <label htmlFor="email" className="fq-label">E-Mail</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="fq-input"
            />
          </div>
          <div className="fq-field">
            <label htmlFor="password" className="fq-label">Passwort</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="fq-input"
            />
          </div>
          <button type="submit" className="fq-btn fq-btn--gradient">
            Anmelden
          </button>
          <p className="fq-text-center">
            <a href="/forgot-password" className="fq-link">Passwort vergessen?</a>
          </p>
        </form>
      </div>
    </div>
  );
}
