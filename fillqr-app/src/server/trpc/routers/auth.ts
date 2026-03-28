import { router } from "../init";
import { protectedProcedure } from "../procedures";

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.user.userId,
    email: ctx.user.email,
    role: ctx.user.role,
    tenantId: ctx.user.tenantId,
  })),
});
