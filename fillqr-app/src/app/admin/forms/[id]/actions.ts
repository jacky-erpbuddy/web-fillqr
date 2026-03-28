"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCaller } from "@/server/trpc/caller";

const VALID_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

export async function updateFormStatus(formData: FormData) {
  const formId = formData.get("formId") as string;
  const status = formData.get("status") as string;

  if (!formId || !VALID_STATUSES.includes(status as ValidStatus)) {
    throw new Error("Ungueltiger Status oder fehlende ID");
  }

  const caller = await createCaller();
  await caller.form.update({
    id: formId,
    status: status as ValidStatus,
  });

  revalidatePath("/admin/forms");
  revalidatePath(`/admin/forms/${formId}`);
  redirect(`/admin/forms/${formId}`);
}
