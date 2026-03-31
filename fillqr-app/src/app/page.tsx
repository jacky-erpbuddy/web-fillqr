import { getTenant } from "@/lib/get-tenant";
import ErrorLayout from "@/components/error-layout";

export default async function Home() {
  const result = await getTenant();

  // Kein Tenant-Slug (reservierte Subdomain oder direkte Domain)
  if (!result) {
    return (
      <main>
        <h1>fillQR</h1>
        <p>Fullstack-App wird eingerichtet.</p>
      </main>
    );
  }

  if (result.status === "not_found") {
    return (
      <ErrorLayout
        title="Diese Seite ist nicht verfügbar"
        message="Die aufgerufene Adresse ist nicht registriert. Prüfe die URL oder besuche unsere Startseite."
      />
    );
  }

  if (result.status === "inactive") {
    return (
      <ErrorLayout
        title="Diese Seite ist derzeit nicht aktiv"
        message="Der Zugang zu dieser Seite wurde vorübergehend deaktiviert. Bei Fragen wende dich an den Betreiber."
      />
    );
  }

  // status === "ok" — Tenant ist aktiv
  return (
    <main>
      <h1>fillQR — {result.tenant.name}</h1>
      <p>Willkommen bei fillQR.</p>
    </main>
  );
}
