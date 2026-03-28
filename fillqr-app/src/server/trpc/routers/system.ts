import { router } from "../init";
import { publicProcedure } from "../procedures";

export const systemRouter = router({
  ping: publicProcedure.query(() => ({
    status: "ok" as const,
    timestamp: new Date(),
  })),
});
