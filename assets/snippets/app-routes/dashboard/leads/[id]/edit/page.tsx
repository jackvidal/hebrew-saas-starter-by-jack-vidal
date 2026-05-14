import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { LeadForm } from "@/components/leads/lead-form";

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const lead = await prisma.lead.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <LeadForm lead={lead} />
    </div>
  );
}
