import type { Metadata } from "next";
import { ProcessMappingForm } from "@/components/masters/process-mapping-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";
import { canUseAllPlantsView } from "@/lib/plants/scope";

export const metadata: Metadata = { title: "New process mapping" };

async function grantedPlantIds(userId: string, organizationId: string, allPlantIds: string[], allPlants: boolean) {
  if (allPlants) {
    return new Set(allPlantIds);
  }
  const rows = await prisma.userPlantAccess.findMany({
    where: { userId, organizationId },
    select: { plantId: true },
  });
  return new Set(rows.map((row) => row.plantId));
}

export default async function NewMappingPage() {
  const context = await requireMasterWriter();
  const { plants } = await loadPlantScope(context);
  const grantedIds = await grantedPlantIds(
    context.userId,
    context.organizationId,
    plants.map((plant) => plant.id),
    canUseAllPlantsView(context.role),
  );
  const visiblePlants = plants.filter((plant) => grantedIds.has(plant.id) && plant.isActive);
  const products = await prisma.product.findMany({
    where: { organizationId: context.organizationId, isActive: true },
    orderBy: { name: "asc" },
  });
  const processes = await prisma.process.findMany({
    where: { organizationId: context.organizationId, isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New process mapping</h1>
      <ProcessMappingForm plants={visiblePlants} products={products} processes={processes} />
    </main>
  );
}
