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

  const [clients, products, specialActivities] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.specialActivity.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New production order</h1>
      <p className="text-sm text-slate-400">
        Creating an order copies the current plant/product process mapping into an order snapshot. Later mapping edits
        will not change this order. Due date defaults to days from the effective production start date.
      </p>
      <ProductionOrderForm
        clients={clients}
        plants={plants.filter((plant) => grantedIds.has(plant.id) && plant.isActive)}
        products={products}
        specialActivities={specialActivities}
      />
    </main>
  );
}
