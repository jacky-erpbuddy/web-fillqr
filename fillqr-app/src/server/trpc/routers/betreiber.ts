import { z } from "zod";
import { router, TRPCError } from "../init";
import { betreiberProcedure } from "../procedures";

/** Reservierte Subdomains — duerfen nicht als Tenant-Slug vergeben werden */
const RESERVED_SLUGS = [
  "app",
  "www",
  "admin",
  "xpgad",
  "demo",
  "api",
  "mail",
  "ftp",
  "cdn",
  "static",
];

const slugSchema = z
  .string()
  .min(3, "Mindestens 3 Zeichen")
  .max(63, "Maximal 63 Zeichen")
  .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Zahlen und Bindestriche")
  .refine((s) => !RESERVED_SLUGS.includes(s), "Reservierte Subdomain");

export const betreiberRouter = router({
  listTenants: betreiberProcedure.query(async ({ ctx }) => {
    return ctx.prisma.tenant.findMany({
      include: {
        tenantApps: {
          include: { app: { select: { key: true, name: true } } },
        },
        _count: { select: { appUsers: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getTenant: betreiberProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenant = await ctx.prisma.tenant.findUnique({
        where: { id: input.id },
        include: {
          tenantApps: {
            include: { app: { select: { key: true, name: true } } },
          },
          appUsers: {
            select: {
              id: true,
              email: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant nicht gefunden" });
      }

      return tenant;
    }),

  createTenant: betreiberProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name ist Pflicht"),
        street: z.string().optional(),
        zip: z.string().optional(),
        city: z.string().optional(),
        email: z.string().email("Ungueltige E-Mail").optional().or(z.literal("")),
        phone: z.string().optional(),
        appKey: z.enum(["vereinsbuddy", "trainerfeedback", "messebuddy"]),
        slug: slugSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // App-Eintrag finden
      const app = await ctx.prisma.app.findUnique({
        where: { key: input.appKey },
      });

      if (!app) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Produkt '${input.appKey}' nicht gefunden` });
      }

      // Slug-Eindeutigkeit pruefen (Unique Constraint in DB, aber bessere Fehlermeldung)
      const existing = await ctx.prisma.tenantApp.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Subdomain bereits vergeben" });
      }

      // Tenant + TenantApp in einer Transaction erstellen
      const tenant = await ctx.prisma.$transaction(async (tx) => {
        const newTenant = await tx.tenant.create({
          data: {
            name: input.name,
            street: input.street || null,
            zip: input.zip || null,
            city: input.city || null,
            email: input.email || null,
            phone: input.phone || null,
          },
        });

        await tx.tenantApp.create({
          data: {
            tenantId: newTenant.id,
            appId: app.id,
            slug: input.slug,
          },
        });

        return newTenant;
      });

      return tenant;
    }),

  updateTenant: betreiberProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        street: z.string().optional(),
        zip: z.string().optional(),
        city: z.string().optional(),
        email: z
          .string()
          .email("Ungueltige E-Mail")
          .optional()
          .or(z.literal("")),
        phone: z.string().optional(),
        status: z
          .enum(["active", "trial", "paused", "cancelled"])
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Leere Strings zu null konvertieren
      const cleanData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleanData[key] = value === "" ? null : value;
        }
      }

      return ctx.prisma.tenant.update({
        where: { id },
        data: cleanData,
      });
    }),

  addProductToTenant: betreiberProcedure
    .input(
      z.object({
        tenantId: z.string(),
        appKey: z.enum(["vereinsbuddy", "trainerfeedback", "messebuddy"]),
        slug: slugSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const app = await ctx.prisma.app.findUnique({
        where: { key: input.appKey },
      });

      if (!app) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Produkt '${input.appKey}' nicht gefunden` });
      }

      // Slug-Eindeutigkeit
      const existing = await ctx.prisma.tenantApp.findUnique({
        where: { slug: input.slug },
      });

      if (existing) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Subdomain bereits vergeben" });
      }

      return ctx.prisma.tenantApp.create({
        data: {
          tenantId: input.tenantId,
          appId: app.id,
          slug: input.slug,
        },
      });
    }),
});
