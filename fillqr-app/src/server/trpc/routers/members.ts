import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, TRPCError } from "../init";
import { protectedProcedure } from "../procedures";
import { sendMail, buildWelcomeEmail } from "@/lib/email";

/** Erlaubte Status-Transitions */
const TRANSITIONS: Record<string, string[]> = {
  eingegangen: ["in_pruefung", "angenommen", "abgelehnt"],
  in_pruefung: ["angenommen", "abgelehnt"],
  angenommen: ["gekuendigt"],
  abgelehnt: ["eingegangen"],
  gekuendigt: [],
};

const STATUS_LABELS: Record<string, string> = {
  eingegangen: "Eingegangen",
  in_pruefung: "In Pruefung",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
  gekuendigt: "Gekuendigt",
};

export { STATUS_LABELS, TRANSITIONS };

export const membersRouter = router({
  /** Dashboard-Stats */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.user.tenantId;
    const [eingegangen, inPruefung, angenommen, gesamt] = await Promise.all([
      ctx.prisma.member.count({ where: { tenantId, status: "eingegangen" } }),
      ctx.prisma.member.count({ where: { tenantId, status: "in_pruefung" } }),
      ctx.prisma.member.count({ where: { tenantId, status: "angenommen" } }),
      ctx.prisma.member.count({ where: { tenantId } }),
    ]);
    return { eingegangen, inPruefung, angenommen, gesamt };
  }),

  /** Letzte N Eingaenge */
  recent: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.member.findMany({
        where: { tenantId: ctx.user.tenantId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
        },
      });
    }),

  /** Gefilterte Mitgliederliste mit Cursor-Pagination */
  list: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        departmentId: z.string().optional(),
        membershipTypeId: z.string().optional(),
        search: z.string().optional(),
        sortBy: z.enum(["date", "name"]).default("date"),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;

      const where: Record<string, unknown> = { tenantId };

      if (input.status) {
        where.status = input.status;
      }

      if (input.membershipTypeId) {
        where.membershipTypeId = input.membershipTypeId;
      }

      if (input.departmentId) {
        where.departments = {
          some: { departmentId: input.departmentId },
        };
      }

      if (input.search) {
        const s = input.search;
        where.OR = [
          { firstName: { contains: s, mode: "insensitive" } },
          { lastName: { contains: s, mode: "insensitive" } },
          { email: { contains: s, mode: "insensitive" } },
        ];
      }

      const orderBy =
        input.sortBy === "name"
          ? [{ lastName: "asc" as const }, { firstName: "asc" as const }]
          : [{ createdAt: "desc" as const }];

      const items = await ctx.prisma.member.findMany({
        where,
        orderBy,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          membershipType: { select: { name: true, fee: true } },
          departments: {
            include: { department: { select: { name: true } } },
          },
        },
      });

      const hasMore = items.length > input.limit;
      const data = hasMore ? items.slice(0, input.limit) : items;
      const nextCursor = hasMore ? data[data.length - 1]?.id : null;

      return { items: data, nextCursor };
    }),

  /** Einzelnes Mitglied */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
        include: {
          membershipType: { select: { name: true, fee: true } },
          departments: {
            include: { department: { select: { name: true, extraFee: true } } },
          },
          tenant: { select: { name: true } },
          guardians: true,
        },
      });

      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mitglied nicht gefunden",
        });
      }

      return member;
    }),

  /** Status-Wechsel mit Transition-Check + History */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        newStatus: z.enum(["eingegangen", "in_pruefung", "angenommen", "abgelehnt", "gekuendigt"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
        select: { id: true, status: true, statusHistory: true },
      });

      if (!member) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mitglied nicht gefunden",
        });
      }

      // Transition pruefen
      const allowed = TRANSITIONS[member.status] ?? [];
      if (!allowed.includes(input.newStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Wechsel von "${STATUS_LABELS[member.status]}" zu "${STATUS_LABELS[input.newStatus]}" ist nicht erlaubt`,
        });
      }

      // History aktualisieren
      const history = Array.isArray(member.statusHistory)
        ? (member.statusHistory as { status: string; at: string }[])
        : [];
      history.push({ status: input.newStatus, at: new Date().toISOString() });

      // Bei Annahme: Mitgliedsnummer vergeben (mit Retry bei Race Condition)
      if (input.newStatus === "angenommen") {
        const tenantId = ctx.user.tenantId;
        let updated;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            updated = await ctx.prisma.$transaction(async (tx) => {
              const highest = await tx.member.findFirst({
                where: { tenantId, memberNo: { not: null } },
                orderBy: { memberNo: "desc" },
                select: { memberNo: true },
              });
              const nextNo = (highest?.memberNo ?? 0) + 1;

              return tx.member.update({
                where: { id: input.id },
                data: {
                  status: "angenommen",
                  memberNo: nextNo,
                  statusHistory: history,
                },
                include: {
                  tenant: { select: { name: true } },
                  membershipType: { select: { name: true, fee: true } },
                },
              });
            });
            break; // Erfolg
          } catch (err) {
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2002" &&
              attempt < 2
            ) {
              continue; // Retry bei UNIQUE Conflict
            }
            throw err;
          }
        }

        // Willkommensmail async senden (Fehler blockiert Annahme NICHT)
        if (updated) {
          const fee = updated.membershipType?.fee
            ? `${updated.membershipType.fee} EUR`
            : "–";
          const { subject, html } = buildWelcomeEmail({
            tenantName: updated.tenant.name,
            firstName: updated.firstName,
            lastName: updated.lastName,
            memberNo: updated.memberNo!,
            fee,
            interval: updated.paymentInterval ?? "–",
            paymentMethod: updated.paymentMethod ?? "–",
          });
          sendMail(updated.email, subject, html).catch((err) =>
            console.error("Willkommensmail fehlgeschlagen:", err),
          );
        }

        return updated;
      }

      return ctx.prisma.member.update({
        where: { id: input.id },
        data: {
          status: input.newStatus,
          statusHistory: history,
        },
      });
    }),
});
