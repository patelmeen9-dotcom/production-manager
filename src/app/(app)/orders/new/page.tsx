import type { Metadata } from "next";
import { ProductionOrderForm } from "@/components/orders/production-order-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";
import { canUseAllPlantsView } from "@/lib/plants/scope";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const context = await requireMasterWriter();
  const { plants } = await loadPlantScope(context);
  const grantedIds = canUseAllPlantsView(context.role)
    ? new Set(plants.map((plant) => plant.id))
    : new Set(
        (
          await prisma.userPlantAccess.findMany({
            where: { userId: context.userId, organizationId: context.organizationId },
            select: { plantId: true },
          })
        ).map((row) => row.plantId),
      );

  const [clients, products, categories, specialActivities, mappings] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      include: { categoryAssignments: { select: { productCategoryId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.productCategory.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      include: { options: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.specialActivity.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.plantProductProcessMapping.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      include: { process: { select: { id: true, code: true, name: true } } },
      orderBy: { sequence: "asc" },
    }),
  ]);

  const mappingsByPlantProduct: Record<
    string,
    Record<string, { processId: string; processCode: string; processName: string; sequence: number }[]>
  > = {};
  for (const row of mappings) {
    const byProduct = mappingsByPlantProduct[row.plantId] ?? {};
    const list = byProduct[row.productId] ?? [];
    list.push({
      processId: row.process.id,
      processCode: row.process.code,
      processName: row.process.name,
      sequence: row.sequence,
    });
    byProduct[row.productId] = list;
    mappingsByPlantProduct[row.plantId] = byProduct;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New production order</h1>
      <p className="text-sm text-slate-400">
        Process lists inherit from plant + product mappings and can be customized per line. Set optional expected
        days per process (units/day comes from the process master). Product categories are optional. Materials are
        tracked per line.
      </p>
      <ProductionOrderForm
        clients={clients}
        plants={plants.filter((plant) => grantedIds.has(plant.id) && plant.isActive)}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          categoryIds: product.categoryAssignments.map((row) => row.productCategoryId),
        }))}
        categories={categories}
        specialActivities={specialActivities}
        mappingsByPlantProduct={mappingsByPlantProduct}
      />
    </main>
  );
}
