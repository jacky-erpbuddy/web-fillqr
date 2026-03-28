import { router } from "../init";
import { systemRouter } from "./system";
import { authRouter } from "./auth";
import { formRouter } from "./form";
import { submissionRouter } from "./submission";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  form: formRouter,
  submission: submissionRouter,
});

export type AppRouter = typeof appRouter;
