import { router } from "../init";
import { systemRouter } from "./system";
import { authRouter } from "./auth";
import { betreiberRouter } from "./betreiber";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  betreiber: betreiberRouter,
});

export type AppRouter = typeof appRouter;
