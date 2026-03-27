import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session.userId) {
    redirect("/login");
  }

  return (
    <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 20px" }}>
      <h1>Dashboard</h1>
      <p>Eingeloggt als {session.email} ({session.role})</p>
      <p style={{ marginTop: 16 }}>
        <a href="/logout">Abmelden</a>
      </p>
    </div>
  );
}
