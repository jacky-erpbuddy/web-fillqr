import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { AppUserRole } from "@/generated/prisma/enums";

export type AuthUser = {
  userId: string;
  tenantId: string;
  email: string;
  role: AppUserRole;
};

const ROLE_LEVEL: Record<AppUserRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  EDITOR: 1,
};

/**
 * Massgebliche Sicherheitspruefung fuer geschuetzte Routen.
 * Prueft Session-Gueltigkeit UND Tenant-Status in DB.
 */
export async function requireAuth(): Promise<AuthUser> {
  let session;
  try {
    session = await getSession();
  } catch {
    // Cookie kaputt oder SESSION_SECRET geaendert
    redirect("/login");
  }

  if (!session.userId || !session.tenantId || !session.email || !session.role) {
    redirect("/login");
  }

  // Tenant-Status in DB pruefen (koennte zwischenzeitlich deaktiviert worden sein)
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { status: true },
  });

  if (!tenant || (tenant.status !== "ACTIVE" && tenant.status !== "TRIAL")) {
    // Session aufraumen, dann redirect
    session.destroy();
    redirect("/login?error=Konto+deaktiviert");
  }

  return {
    userId: session.userId,
    tenantId: session.tenantId,
    email: session.email,
    role: session.role as AppUserRole,
  };
}

/**
 * Prueft ob der User mindestens die angegebene Rolle hat.
 * Hierarchie: OWNER > ADMIN > EDITOR
 */
export async function requireRole(minRole: AppUserRole): Promise<AuthUser> {
  const user = await requireAuth();

  if (ROLE_LEVEL[user.role] < ROLE_LEVEL[minRole]) {
    redirect("/dashboard?error=Keine+Berechtigung");
  }

  return user;
}

/**
 * Prueft ob die angefragte tenantId zur Session passt.
 * NUR dort einsetzen wo eine tenantId von aussen reinkommt
 * (API-Routen, URL-Parameter). Nicht kuenstlich ueberall einbauen.
 */
export async function assertTenantAccess(tenantId: string): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.tenantId !== tenantId) {
    redirect("/dashboard?error=Kein+Zugriff");
  }

  return user;
}
