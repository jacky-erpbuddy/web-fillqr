import { requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 20px" }}>
      <h1>Dashboard</h1>
      <p>Eingeloggt als {user.email} ({user.role})</p>
      <p style={{ marginTop: 16 }}>
        <a href="/logout">Abmelden</a>
      </p>
    </div>
  );
}
