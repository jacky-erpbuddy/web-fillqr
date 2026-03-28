import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { createCaller } from "@/server/trpc/caller";
import { FormRenderer } from "./FormRenderer";

type Props = {
  params: Promise<{ tenantSlug: string; formSlug: string }>;
};

export default async function PublicFormPage({ params }: Props) {
  const { tenantSlug, formSlug } = await params;

  let form;
  try {
    const caller = await createCaller();
    form = await caller.form.getBySlug({ tenantSlug, formSlug });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-lg">
        {/* Header / Branding */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500">{form.tenantName}</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            {form.title}
          </h1>
        </div>

        {/* Form */}
        <FormRenderer
          tenantSlug={tenantSlug}
          formSlug={formSlug}
          fields={form.fields}
        />
      </div>
    </div>
  );
}
