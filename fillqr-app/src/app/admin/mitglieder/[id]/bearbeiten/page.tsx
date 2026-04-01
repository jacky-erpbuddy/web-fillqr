import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditMemberForm from "./EditMemberForm";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const member = await prisma.member.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      departments: { select: { departmentId: true } },
    },
  });

  if (!member) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {member.firstName} {member.lastName} bearbeiten
      </h1>
      <EditMemberForm
        member={{
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          phone: member.phone ?? "",
          street: member.street ?? "",
          zip: member.zip ?? "",
          city: member.city ?? "",
          birthdate: member.birthdate?.toISOString().split("T")[0] ?? "",
          notes: member.notes ?? "",
          membershipTypeId: member.membershipTypeId ?? "",
          paymentInterval: member.paymentInterval ?? "",
          paymentMethod: member.paymentMethod ?? "",
        }}
      />
    </div>
  );
}
