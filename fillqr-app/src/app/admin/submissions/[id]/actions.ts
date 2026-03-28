"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCaller } from "@/server/trpc/caller";

const VALID_STATUSES = ["NEW", "IN_REVIEW", "DONE", "ARCHIVED"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function updateSubmissionStatus(formData: FormData) {
  const submissionId = formData.get("submissionId") as string;
  const status = formData.get("status") as string;

  if (!submissionId || !VALID_STATUSES.includes(status as ValidStatus)) {
    throw new Error("Ungueltiger Status oder fehlende ID");
  }

  const caller = await createCaller();
  await caller.submission.updateStatus({
    submissionId,
    status: status as ValidStatus,
  });

  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  redirect(`/admin/submissions/${submissionId}`);
}
