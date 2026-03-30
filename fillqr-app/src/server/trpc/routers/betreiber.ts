import { z } from "zod";
import { randomUUID } from "crypto";
import { router, TRPCError } from "../init";
import { betreiberProcedure } from "../procedures";
import { sendMail, buildInviteEmail } from "@/lib/email";

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

  addUser: betreiberProcedure
    .input(
      z.object({
        tenantId: z.string(),
        email: z.string().email("Ungueltige E-Mail"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = input.email.trim().toLowerCase();

      // Pruefen ob Email bereits existiert
      const existing = await ctx.prisma.appUser.findUnique({
        where: { email },
      });

      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "E-Mail-Adresse bereits vergeben",
        });
      }

      // Tenant + ersten Slug fuer Email-Link holen
      const tenantApp = await ctx.prisma.tenantApp.findFirst({
        where: { tenantId: input.tenantId, isEnabled: true },
        select: { slug: true },
      });

      if (!tenantApp) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tenant hat kein aktives Produkt — bitte zuerst ein Produkt zuordnen",
        });
      }

      const inviteToken = randomUUID();
      const inviteExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

      const user = await ctx.prisma.appUser.create({
        data: {
          tenantId: input.tenantId,
          email,
          passwordHash: "INVITE_PENDING",
          inviteToken,
          inviteExpiresAt,
        },
      });

      // Mail senden — bei Fehler: User bleibt, Warnung zurueckgeben
      const link = `https://${tenantApp.slug}.fillqr.de/set-password?token=${inviteToken}`;
      const { subject, html } = buildInviteEmail(link);

      try {
        await sendMail(email, subject, html);
      } catch (err) {
        console.error("[INVITE] Mail-Versand fehlgeschlagen:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User angelegt, aber Einladungs-Mail konnte nicht gesendet werden. Token ist in der DB — Link kann manuell weitergegeben werden.",
        });
      }

      return user;
    }),
});
