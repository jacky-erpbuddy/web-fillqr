import { router } from "../init";
import { systemRouter } from "./system";
import { authRouter } from "./auth";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
