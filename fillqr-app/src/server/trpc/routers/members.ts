import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { router, TRPCError } from "../init";
import { protectedProcedure } from "../procedures";
import { sendMail, buildWelcomeEmail, sendTemplatedMail } from "@/lib/email";

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
        reason: z.string().optional(),
        exitDate: z.string().optional(), // Austrittsdatum (nur bei gekuendigt)
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.member.findFirst({
        where: { id: input.id, tenantId: ctx.user.tenantId },
        select: { id: true, status: true, statusHistory: true, familyGroupId: true, familyHead: true },
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

        // Gruppen-Annahme: Wenn Head angenommen → alle Familienmitglieder annehmen
        if (member.familyGroupId && member.familyHead) {
          // Nur Mitglieder in annehmbarem Status (Finding 6: nicht abgelehnt → angenommen)
          const familyMembers = await ctx.prisma.member.findMany({
            where: {
              familyGroupId: member.familyGroupId,
              id: { not: input.id },
              status: { in: ["eingegangen", "in_pruefung"] },
            },
          });

          for (const fm of familyMembers) {
            // Eigene memberNo + Status für jedes Familienmitglied
            for (let fmAttempt = 0; fmAttempt < 3; fmAttempt++) {
              try {
                const fmUpdated = await ctx.prisma.$transaction(async (tx) => {
                  const highest = await tx.member.findFirst({
                    where: { tenantId, memberNo: { not: null } },
                    orderBy: { memberNo: "desc" },
                    select: { memberNo: true },
                  });
                  const nextNo = (highest?.memberNo ?? 0) + 1;
                  const fmHistory = Array.isArray(fm.statusHistory)
                    ? (fm.statusHistory as { status: string; at: string }[])
                    : [];
                  fmHistory.push({ status: "angenommen", at: new Date().toISOString() });

                  return tx.member.update({
                    where: { id: fm.id },
                    data: { status: "angenommen", memberNo: nextNo, statusHistory: fmHistory },
                    include: { tenant: { select: { name: true } }, membershipType: { select: { name: true, fee: true } } },
                  });
                });

                // Willkommensmail fuer Familienmitglied
                if (fmUpdated) {
                  const fmFee = fmUpdated.membershipType?.fee ? `${fmUpdated.membershipType.fee} EUR` : "–";
                  const { subject: fmSubject, html: fmHtml } = buildWelcomeEmail({
                    tenantName: fmUpdated.tenant.name,
                    firstName: fmUpdated.firstName,
                    lastName: fmUpdated.lastName,
                    memberNo: fmUpdated.memberNo!,
                    fee: fmFee,
                    interval: fmUpdated.paymentInterval ?? "–",
                    paymentMethod: fmUpdated.paymentMethod ?? "–",
                  });
                  sendMail(fmUpdated.email, fmSubject, fmHtml).catch((err) =>
                    console.error("Willkommensmail (Familie) fehlgeschlagen:", err),
                  );
                }
                break;
              } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && fmAttempt < 2) {
                  continue;
                }
                console.error("Familien-Annahme fehlgeschlagen:", err);
                break;
              }
            }
          }
        }

        return updated;
      }

      const updateData: Record<string, unknown> = {
        status: input.newStatus,
        statusHistory: history,
      };
      // Austrittsdatum bei Kündigung (Server-Validierung: Pflicht)
      if (input.newStatus === "gekuendigt") {
        if (!input.exitDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Austrittsdatum ist bei Kuendigung Pflicht" });
        }
        updateData.exitDate = new Date(input.exitDate);
      }

      const result = await ctx.prisma.member.update({
        where: { id: input.id },
        data: updateData,
        include: { tenant: { select: { name: true } } },
      });

      // Ablehnungsmail senden (AP-24)
      if (input.newStatus === "abgelehnt") {
        sendTemplatedMail(ctx.prisma, ctx.user.tenantId, "member_reject", result.email, {
          vereinsname: result.tenant.name,
          vorname: result.firstName,
          nachname: result.lastName,
          mitgliedsname: `${result.firstName} ${result.lastName}`,
          ablehnungsgrund: input.reason ? `Begruendung: ${input.reason}` : "",
        }).catch((err) => console.error("Ablehnungsmail fehlgeschlagen:", err));
      }

      return result;
    }),

  /** Mitglied manuell anlegen (AP-28) */
  create: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        street: z.string().optional(),
        zip: z.string().optional(),
        city: z.string().optional(),
        birthdate: z.string().optional(),
        membershipTypeId: z.string().optional(),
        paymentInterval: z.string().optional(),
        paymentMethod: z.string().optional(),
        departmentIds: z.array(z.string()).default([]),
        status: z.enum(["eingegangen", "angenommen"]).default("eingegangen"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.user.tenantId;
      const birthdate = input.birthdate ? new Date(input.birthdate) : null;

      // Bei "angenommen": memberNo sofort vergeben
      let memberNo: number | null = null;
      if (input.status === "angenommen") {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await ctx.prisma.$transaction(async (tx) => {
              const highest = await tx.member.findFirst({
                where: { tenantId, memberNo: { not: null } },
                orderBy: { memberNo: "desc" },
                select: { memberNo: true },
              });
              return (highest?.memberNo ?? 0) + 1;
            });
            memberNo = result;
            break;
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && attempt < 2) continue;
            throw err;
          }
        }
      }

      const member = await ctx.prisma.member.create({
        data: {
          tenantId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone || null,
          street: input.street || null,
          zip: input.zip || null,
          city: input.city || null,
          birthdate,
          membershipTypeId: input.membershipTypeId || null,
          paymentInterval: input.paymentInterval || null,
          paymentMethod: input.paymentMethod || null,
          status: input.status,
          memberNo,
          statusHistory: [{ status: input.status, at: new Date().toISOString() }],
        },
      });

      // Sparten zuordnen
      if (input.departmentIds.length > 0) {
        await ctx.prisma.memberDepartment.createMany({
          data: input.departmentIds.map((deptId) => ({ memberId: member.id, departmentId: deptId })),
        });
      }

      return member;
    }),

  /** Mitglied bearbeiten mit Changelog (AP-28) */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        street: z.string().optional(),
        zip: z.string().optional(),
        city: z.string().optional(),
        birthdate: z.string().optional(),
        membershipTypeId: z.string().optional(),
        paymentInterval: z.string().optional(),
        paymentMethod: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const tenantId = ctx.user.tenantId;

      const current = await ctx.prisma.member.findFirst({
        where: { id, tenantId },
      });
      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mitglied nicht gefunden" });
      }

      // Changelog erstellen
      const changes: { at: string; userId: string; field: string; from: string; to: string }[] = [];
      const now = new Date().toISOString();
      const userId = ctx.user.userId;

      const checkFields = ["firstName", "lastName", "email", "phone", "street", "zip", "city", "notes", "membershipTypeId", "paymentInterval", "paymentMethod"] as const;
      for (const field of checkFields) {
        if (updates[field] !== undefined && updates[field] !== (current[field] ?? "")) {
          changes.push({ at: now, userId, field, from: String(current[field] ?? ""), to: String(updates[field] ?? "") });
        }
      }
      if (updates.birthdate !== undefined) {
        const oldBd = current.birthdate?.toISOString().split("T")[0] ?? "";
        if (updates.birthdate !== oldBd) {
          changes.push({ at: now, userId, field: "birthdate", from: oldBd, to: updates.birthdate });
        }
      }

      const existingLog = Array.isArray(current.changeLog) ? current.changeLog as unknown[] : [];
      const newLog = [...existingLog, ...changes];

      const data: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) {
          if (key === "birthdate") {
            data[key] = val ? new Date(val) : null;
          } else {
            data[key] = val || null;
          }
        }
      }
      data.changeLog = newLog;

      return ctx.prisma.member.update({ where: { id }, data });
    }),
});
