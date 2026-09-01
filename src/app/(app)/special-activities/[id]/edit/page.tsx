import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpecialActivityForm } from "@/components/masters/special-activity-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Edit special activity" };

export default async function EditSpecialActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireMasterWriter();
  const { id } = await params;
  const activity = await prisma.specialActivity.findFirst({ where: { id, organizationId } });
  if (!activity) {
    notFound();
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Edit special activity</h1>
      <SpecialActivityForm activity={activity} />
    </main>
  );
}
