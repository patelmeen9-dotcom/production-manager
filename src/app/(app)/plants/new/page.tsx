import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { PlantForm } from "@/components/plants/plant-form";
import { requireRoles } from "@/lib/auth/session";

export const metadata: Metadata = { title: "New plant" };

export default async function NewPlantPage() {
  const context = await requireRoles([Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN]);
  if (!context.organizationId) {
    redirect("/dashboard");
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New plant</h1>
      <PlantForm />
    </main>
  );
}
