import { router } from "../init";
import { systemRouter } from "./system";
import { authRouter } from "./auth";
import { betreiberRouter } from "./betreiber";
import { settingsRouter } from "./settings";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  betreiber: betreiberRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
