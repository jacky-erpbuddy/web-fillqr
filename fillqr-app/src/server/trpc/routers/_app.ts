import { router } from "../init";
import { systemRouter } from "./system";
import { authRouter } from "./auth";
import { formRouter } from "./form";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  form: formRouter,
});

export type AppRouter = typeof appRouter;
