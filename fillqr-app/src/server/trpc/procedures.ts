import { publicProcedure, middleware, TRPCError } from "./init";
import type { AuthUser } from "@/lib/auth";

/** Context-Erweiterung nach Auth-Pruefung */
type ProtectedContext = {
  user: AuthUser;
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

  if (!tenant || (tenant.status !== "active" && tenant.status !== "trial")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Konto deaktiviert" });
  }

  const user: AuthUser = {
    userId: ctx.session.userId,
    tenantId: ctx.session.tenantId,
    email: ctx.session.email,
    appKey: ctx.session.appKey,
  };

  return next({ ctx: { user } satisfies ProtectedContext });
});

/**
 * Betreiber-Middleware: Prueft Betreiber-Session (admin.fillqr.de).
 * Kein Tenant-Check — Betreiber hat Zugriff auf alle Tenants.
 */
const isBetreiber = middleware(async ({ ctx, next }) => {
  if (!ctx.betreiberSession?.isBetreiber) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Kein Betreiber-Zugang",
    });
  }

  return next();
});

/** Procedure ohne Auth — jeder kann zugreifen */
export { publicProcedure };

/** Procedure mit Auth — nur eingeloggte User mit aktivem Tenant */
export const protectedProcedure = publicProcedure.use(isAuthed);

/** Procedure mit Betreiber-Auth — nur Betreiber (admin.fillqr.de) */
export const betreiberProcedure = publicProcedure.use(isBetreiber);
