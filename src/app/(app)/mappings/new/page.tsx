import type { Metadata } from "next";
import { ProcessMappingForm } from "@/components/masters/process-mapping-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";

export const metadata: Metadata = { title: "New process mapping" };

export default async function NewMappingPage() {
  const context = await requireMasterWriter();
  const [{ plants, grantedPlantIds }, products, processes] = await Promise.all([
    loadPlantScope(context),
    prisma.product.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.process.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const grantedIds = new Set(grantedPlantIds);
  const visiblePlants = plants.filter((plant) => grantedIds.has(plant.id) && plant.isActive);

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New process mapping</h1>
      <ProcessMappingForm plants={visiblePlants} products={products} processes={processes} />
    </main>
  );
}
