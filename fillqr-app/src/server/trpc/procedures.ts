import { publicProcedure, middleware, TRPCError } from "./init";
import type { AuthUser } from "@/lib/auth";
import type { AppUserRole } from "@/generated/prisma/enums";

/** Context-Erweiterung nach Auth-Pruefung */
type ProtectedContext = {
  user: AuthUser;
};

const ROLE_LEVEL: Record<AppUserRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  EDITOR: 1,
};

/**
 * Auth-Middleware: Prueft Session + Tenant-Status.
 * Wirft TRPCError statt redirect (API-Route, nicht Server Component).
 */
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.session?.userId || !ctx.session?.tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Nicht eingeloggt" });
  }

  // Tenant-Status in DB pruefen
  const tenant = await ctx.prisma.tenant.findUnique({
    where: { id: ctx.session.tenantId },
    select: { status: true },
  });

  if (!tenant || (tenant.status !== "ACTIVE" && tenant.status !== "TRIAL")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Konto deaktiviert" });
  }

  const user: AuthUser = {
    userId: ctx.session.userId,
    tenantId: ctx.session.tenantId,
    email: ctx.session.email,
    role: ctx.session.role as AppUserRole,
  };

  return next({ ctx: { user } satisfies ProtectedContext });
});

/** Procedure ohne Auth — jeder kann zugreifen */
export { publicProcedure };

/** Procedure mit Auth — nur eingeloggte User mit aktivem Tenant */
export const protectedProcedure = publicProcedure.use(isAuthed);

export { ROLE_LEVEL };
