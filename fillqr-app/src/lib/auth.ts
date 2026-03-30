import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type AuthUser = {
  userId: string;
  tenantId: string;
  email: string;
  appKey: string;
};

/**
 * Massgebliche Sicherheitspruefung fuer geschuetzte Routen.
 * Prueft Session-Gueltigkeit UND Tenant-Status in DB.
 * Alte Sessions ohne appKey → Force-Logout.
 */
export async function requireAuth(): Promise<AuthUser> {
  let session;
  try {
    session = await getSession();
  } catch (err) {
    // Cookie kaputt oder SESSION_SECRET geaendert
    console.error("[AUTH] getSession failed:", err);
    redirect("/login");
  }

  if (!session.userId || !session.tenantId || !session.email) {
    console.error("[AUTH] session fields missing:", {
      hasUserId: !!session.userId,
      hasTenantId: !!session.tenantId,
      hasEmail: !!session.email,
    });
    redirect("/login");
  }

  // Alte Sessions ohne appKey → Force-Logout
  if (!session.appKey) {
    session.destroy();
    redirect("/login");
  }

  // Tenant-Status in DB pruefen (koennte zwischenzeitlich deaktiviert worden sein)
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { status: true },
  });

  if (!tenant || (tenant.status !== "active" && tenant.status !== "trial")) {
    // Session aufraumen, dann redirect
    session.destroy();
    redirect("/login?error=Konto+deaktiviert");
  }

  return {
    userId: session.userId,
    tenantId: session.tenantId,
    email: session.email,
    appKey: session.appKey,
  };
}

/**
 * Prueft ob die angefragte tenantId zur Session passt.
 * NUR dort einsetzen wo eine tenantId von aussen reinkommt
 * (API-Routen, URL-Parameter). Nicht kuenstlich ueberall einbauen.
 */
export async function assertTenantAccess(tenantId: string): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.tenantId !== tenantId) {
    redirect("/admin/dashboard?error=Kein+Zugriff");
  }

  return user;
}
