import { z } from "zod";
import { router, TRPCError } from "../init";
import { protectedProcedure } from "../procedures";
import {
  vereinsbuddySettingsSchema,
  parseSettings,
} from "@/lib/settings-schema";

export const settingsRouter = router({
  /** Alle Einstellungs-Daten fuer den Tenant laden */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;

    const [tenant, departments, membershipTypes, tenantApp] = await Promise.all(
      [
        ctx.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            street: true,
            zip: true,
            city: true,
            email: true,
            phone: true,
            logoPath: true,
          },
        }),
        ctx.prisma.department.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
        }),
        ctx.prisma.membershipType.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
        }),
        ctx.prisma.tenantApp.findFirst({
          where: {
            tenantId,
            app: { key: ctx.user.appKey },
          },
          select: { id: true, settingsJson: true },
        }),
      ],
    );

    if (!tenant || !tenantApp) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Tenant nicht gefunden" });
    }

    return {
      tenant,
      departments,
      membershipTypes,
      tenantAppId: tenantApp.id,
      settings: parseSettings(tenantApp.settingsJson),
    };
  }),

  // ─── Vereinsdaten (tbl_tenants) ───

  updateTenantInfo: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name ist Pflicht"),
        street: z.string().optional(),
        zip: z.string().optional(),
        city: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.tenant.update({
        where: { id: ctx.user.tenantId },
        data: {
          name: input.name,
          street: input.street || null,
          zip: input.zip || null,
          city: input.city || null,
          email: input.email || null,
          phone: input.phone || null,
        },
      });
    }),

  // ─── Sparten (tbl_departments) ───

  createDepartment: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name ist Pflicht"),
        extraFee: z.number().min(0).default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.department.create({
        data: {
          tenantId: ctx.user.tenantId,
          name: input.name,
          extraFee: input.extraFee,
        },
      });
    }),

  updateDepartment: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Name ist Pflicht"),
        extraFee: z.number().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Tenant-Isolation: Nur eigene Sparten bearbeiten
      const dept = await ctx.prisma.department.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
      });
      if (!dept) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sparte nicht gefunden" });
      }
      return ctx.prisma.department.update({
        where: { id: input.id },
        data: { name: input.name, extraFee: input.extraFee },
      });
    }),

  toggleDepartment: protectedProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const dept = await ctx.prisma.department.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
      });
      if (!dept) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sparte nicht gefunden" });
      }
      return ctx.prisma.department.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),

  // ─── Mitgliedstypen (tbl_membership_types) ───

  createMembershipType: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name ist Pflicht"),
        fee: z.number().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.membershipType.create({
        data: {
          tenantId: ctx.user.tenantId,
          name: input.name,
          fee: input.fee,
        },
      });
    }),

  updateMembershipType: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Name ist Pflicht"),
        fee: z.number().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const mt = await ctx.prisma.membershipType.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
      });
      if (!mt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mitgliedstyp nicht gefunden" });
      }
      return ctx.prisma.membershipType.update({
        where: { id: input.id },
        data: { name: input.name, fee: input.fee },
      });
    }),

  toggleMembershipType: protectedProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const mt = await ctx.prisma.membershipType.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
      });
      if (!mt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mitgliedstyp nicht gefunden" });
      }
      return ctx.prisma.membershipType.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),

  // ─── Settings-JSON (tbl_tenant_apps.settings_json) ───

  updateSettings: protectedProcedure
    .input(vereinsbuddySettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantApp = await ctx.prisma.tenantApp.findFirst({
        where: {
          tenantId: ctx.user.tenantId,
          app: { key: ctx.user.appKey },
        },
      });

      if (!tenantApp) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produkt nicht gefunden" });
      }

      return ctx.prisma.tenantApp.update({
        where: { id: tenantApp.id },
        data: { settingsJson: input as object },
      });
    }),
});
