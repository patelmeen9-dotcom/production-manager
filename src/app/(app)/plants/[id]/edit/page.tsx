import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { PlantForm } from "@/components/plants/plant-form";
import { requireRoles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Edit plant" };

export default async function EditPlantPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireRoles([Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN]);
  if (!context.organizationId) {
    redirect("/dashboard");
  }
  const { id } = await params;
  const plant = await prisma.plant.findFirst({
    where: { id, organizationId: context.organizationId },
  });
  if (!plant) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Edit plant</h1>
      <PlantForm plant={plant} />
    </main>
  );
}
