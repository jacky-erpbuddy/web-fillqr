import { z } from "zod";
import { router, TRPCError } from "../init";
import { publicProcedure, protectedProcedure } from "../procedures";
import type { FormFieldType } from "@/generated/prisma/enums";
import type { SubmissionStatus } from "@/generated/prisma/enums";

/** Erlaubte Statusuebergaenge (AP-14) */
const ALLOWED_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  NEW: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["NEW", "DONE"],
  DONE: ["ARCHIVED"],
  ARCHIVED: [],
};

type Field = {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  config: unknown;
};

/**
 * Validiert den Payload gegen die FormFields.
 * Gibt ein bereinigtes Payload-Objekt zurueck (nur bekannte Keys).
 * Wirft TRPCError bei Validierungsfehlern.
 */
function validatePayload(
  payload: Record<string, unknown>,
  fields: Field[]
): Record<string, unknown> {
  const errors: string[] = [];
  const cleaned: Record<string, unknown> = {};

  for (const field of fields) {
    const value = payload[field.key];
    const isEmpty = value === undefined || value === null || value === "";

    // Required-Check
    if (field.required && isEmpty) {
      errors.push(`${field.label}: Pflichtfeld`);
      continue;
    }

    // Optionales Feld nicht ausgefuellt → ueberspringen
    if (isEmpty) {
      continue;
    }

    // Typ-Validierung
    switch (field.type) {
      case "TEXT":
      case "TEXTAREA": {
        if (typeof value !== "string") {
          errors.push(`${field.label}: Text erwartet`);
        } else {
          cleaned[field.key] = value;
        }
        break;
      }

      case "EMAIL": {
        if (typeof value !== "string" || !/.+@.+\..+/.test(value)) {
          errors.push(`${field.label}: Ungueltige E-Mail-Adresse`);
        } else {
          cleaned[field.key] = value;
        }
        break;
      }

      case "PHONE": {
        if (typeof value !== "string" || !/^\+?[\d\s\-()]{7,}$/.test(value)) {
          errors.push(`${field.label}: Ungueltige Telefonnummer`);
        } else {
          cleaned[field.key] = value;
        }
        break;
      }

      case "CHECKBOX": {
        if (typeof value !== "boolean") {
          errors.push(`${field.label}: Ja/Nein erwartet`);
        } else {
          cleaned[field.key] = value;
        }
        break;
      }

      case "DATE": {
        if (
          typeof value !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          isNaN(new Date(value).getTime())
        ) {
          errors.push(`${field.label}: Datum im Format YYYY-MM-DD erwartet`);
        } else {
          cleaned[field.key] = value;
        }
        break;
      }

      case "SELECT": {
        const config = field.config as { options?: string[] } | null;
        if (!config?.options || !Array.isArray(config.options)) {
          errors.push(`${field.label}: Auswahlfeld nicht korrekt konfiguriert`);
          break;
        }
        if (typeof value !== "string" || !config.options.includes(value)) {
          errors.push(
            `${field.label}: Ungueltiger Wert`
          );
        } else {
          cleaned[field.key] = value;
        }
        break;
      }

      default:
        // Unbekannter Feldtyp → sicher ignorieren
        break;
    }
  }

  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Validierungsfehler: ${errors.join("; ")}`,
    });
  }

  return cleaned;
}

export const submissionRouter = router({
  create: publicProcedure
    .input(
      z.object({
        tenantSlug: z.string().min(1),
        formSlug: z.string().min(1),
        payload: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Form + Tenant laden (ein Query, gleicher Pattern wie form.getBySlug)
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
            select: { id: true },
          },
        },
      });

      if (!form) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Formular nicht verfuegbar",
        });
      }

      // 2. Payload validieren + bereinigen
      const cleanedPayload = validatePayload(input.payload, form.fields);

      // 3. Submission speichern
      try {
        const submission = await ctx.prisma.submission.create({
          data: {
            formId: form.id,
            tenantId: form.tenant.id,
            payload: cleanedPayload as Record<string, string | boolean>,
            status: "NEW",
          },
          select: { id: true },
        });

        return { id: submission.id };
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Fehler beim Speichern",
        });
      }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        submissionId: z.string().min(1),
        status: z.enum(["NEW", "IN_REVIEW", "DONE", "ARCHIVED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Submission laden (minimal)
      const submission = await ctx.prisma.submission.findUnique({
        where: { id: input.submissionId },
        select: { id: true, tenantId: true, status: true },
      });

      // 2. Nicht gefunden oder falscher Tenant → NOT_FOUND (kein Info-Leak)
      if (!submission || submission.tenantId !== ctx.user.tenantId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Einsendung nicht gefunden",
        });
      }

      // 3. No-Op und ungueltige Uebergaenge pruefen
      const currentStatus = submission.status as SubmissionStatus;
      const newStatus = input.status as SubmissionStatus;
      const allowed = ALLOWED_TRANSITIONS[currentStatus];

      if (currentStatus === newStatus || !allowed.includes(newStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Statuswechsel von ${currentStatus} nach ${newStatus} nicht erlaubt`,
        });
      }

      // 4. Status aktualisieren
      const updated = await ctx.prisma.submission.update({
        where: { id: submission.id },
        data: { status: newStatus },
        select: { id: true, status: true },
      });

      return { id: updated.id, status: updated.status };
    }),
});
