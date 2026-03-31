import { router } from "../init";
import { systemRouter } from "./system";
import { authRouter } from "./auth";
import { betreiberRouter } from "./betreiber";
import { settingsRouter } from "./settings";
import { membersRouter } from "./members";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  betreiber: betreiberRouter,
  settings: settingsRouter,
  members: membersRouter,
});

export type AppRouter = typeof appRouter;
