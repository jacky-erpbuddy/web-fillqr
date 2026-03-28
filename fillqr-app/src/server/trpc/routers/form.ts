import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, TRPCError } from "../init";
import { publicProcedure, protectedProcedure } from "../procedures";
import type { FormFieldType, FormStatus, FormType } from "@/generated/prisma/enums";

// -- Schemas -----------------------------------------------------------------

const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt");

/** Config-Schema: nur SELECT hat options, alle anderen leer. */
const fieldConfigSchema = z
  .object({ options: z.array(z.string().min(1)).min(1) })
  .nullable()
  .optional();

const fieldInputSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Nur Kleinbuchstaben, Zahlen und Unterstriche"),
  label: z.string().min(1).max(200),
  type: z.enum(["TEXT", "TEXTAREA", "EMAIL", "PHONE", "SELECT", "CHECKBOX", "DATE"]),
  required: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  config: fieldConfigSchema.default(null),
});

const fieldsArraySchema = z.array(fieldInputSchema).superRefine((fields, ctx) => {
  // Duplicate key check
  const keys = fields.map((f) => f.key);
  const seen = new Set<string>();
  for (let i = 0; i < keys.length; i++) {
    if (seen.has(keys[i])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Doppelter Feld-Key: ${keys[i]}`,
        path: [i, "key"],
      });
    }
    seen.add(keys[i]);
  }
  // SELECT must have options
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.type === "SELECT") {
      const cfg = f.config as { options?: string[] } | null;
      if (!cfg?.options || cfg.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `SELECT-Feld "${f.label}" braucht mindestens eine Option`,
          path: [i, "config"],
        });
      }
    }
  }
});

/** Erlaubte Status-Wechsel fuer Formulare */
const FORM_STATUS_TRANSITIONS: Record<FormStatus, FormStatus[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
};

// -- Router ------------------------------------------------------------------

export const formRouter = router({
  /** Oeffentlich: Form + Felder anhand Tenant-/Form-Slug laden */
  getBySlug: publicProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(1),
        formSlug: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const form = await ctx.prisma.form.findFirst({
        where: {
          slug: input.formSlug,
          status: "PUBLISHED",
          tenant: {
            slug: input.tenantSlug,
            status: { in: ["ACTIVE", "TRIAL"] },
          },
        },
        include: {
          fields: {
            orderBy: { sortOrder: "asc" },
          },
          tenant: {
            select: { name: true },
          },
        },
      });

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Formular nicht gefunden",
        });
      }

      return {
        title: form.title,
        slug: form.slug,
        type: form.type,
        tenantName: form.tenant.name,
        fields: form.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          config: f.config,
          sortOrder: f.sortOrder,
        })),
      };
    }),

  /** Admin: Alle Formulare des Tenants (einfache Liste, keine Pagination) */
  list: protectedProcedure.query(async ({ ctx }) => {
    const forms = await ctx.prisma.form.findMany({
      where: { tenantId: ctx.user.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        status: true,
        createdAt: true,
        _count: {
          select: { fields: true, submissions: true },
        },
      },
    });

    return forms;
  }),

  /** Admin: Einzelnes Formular mit Feldern laden */
  getById: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const form = await ctx.prisma.form.findUnique({
        where: { id: input.id, tenantId: ctx.user.tenantId },
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          status: true,
          settings: true,
          createdAt: true,
          updatedAt: true,
          tenant: { select: { slug: true } },
          _count: { select: { submissions: true } },
          fields: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              key: true,
              label: true,
              type: true,
              required: true,
              config: true,
              sortOrder: true,
            },
          },
        },
      });

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Formular nicht gefunden",
        });
      }

      return form;
    }),

  /** Admin: Neues Formular mit Feldern erstellen (Transaktion) */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        slug: slugSchema,
        type: z.enum(["VEREIN", "FEEDBACK", "LEAD"]),
        fields: fieldsArraySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const form = await ctx.prisma.form.create({
          data: {
            tenantId: ctx.user.tenantId,
            title: input.title,
            slug: input.slug,
            type: input.type as FormType,
            status: "DRAFT",
            fields: {
              create: input.fields.map((f) => ({
                key: f.key,
                label: f.label,
                type: f.type as FormFieldType,
                required: f.required,
                sortOrder: f.sortOrder,
                config:
                  f.type === "SELECT" && f.config
                    ? (f.config as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
              })),
            },
          },
          select: { id: true, slug: true },
        });

        return form;
      } catch (err: unknown) {
        // Prisma unique constraint violation (tenant_id + slug)
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ein Formular mit diesem Slug existiert bereits",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fehler beim Erstellen",
        });
      }
    }),

  /** Admin: Formular-Metadaten und Status aendern */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Form laden + Tenant-Check
      const form = await ctx.prisma.form.findUnique({
        where: { id: input.id, tenantId: ctx.user.tenantId },
        select: { id: true, status: true },
      });

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Formular nicht gefunden",
        });
      }

      // 2. Status-Wechsel pruefen (wenn angefragt)
      if (input.status) {
        const current = form.status as FormStatus;
        const target = input.status as FormStatus;
        const allowed = FORM_STATUS_TRANSITIONS[current];

        if (current === target) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Formular hat bereits den Status ${current}`,
          });
        }

        if (!allowed.includes(target)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Statuswechsel von ${current} nach ${target} nicht erlaubt`,
          });
        }
      }

      // 3. Update
      const updated = await ctx.prisma.form.update({
        where: { id: form.id },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.status && { status: input.status }),
        },
        select: { id: true, title: true, status: true },
      });

      return updated;
    }),
});

export { FORM_STATUS_TRANSITIONS };
