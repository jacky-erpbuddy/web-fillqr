import { z } from "zod";
import { router, TRPCError } from "../init";
import { publicProcedure } from "../procedures";

export const formRouter = router({
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
});
