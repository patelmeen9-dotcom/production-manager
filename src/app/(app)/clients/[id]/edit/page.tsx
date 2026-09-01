import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/masters/client-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireMasterWriter();
  const { id } = await params;
  const client = await prisma.client.findFirst({ where: { id, organizationId } });
  if (!client) {
    notFound();
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Edit client</h1>
      <ClientForm client={client} />
    </main>
  );
}
