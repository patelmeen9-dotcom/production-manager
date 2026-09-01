import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProcessForm } from "@/components/masters/process-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Edit process" };

export default async function EditProcessPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireMasterWriter();
  const { id } = await params;
  const process = await prisma.process.findFirst({ where: { id, organizationId } });
  if (!process) {
    notFound();
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Edit process</h1>
      <ProcessForm process={process} />
    </main>
  );
}
