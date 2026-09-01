import type { Metadata } from "next";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";
import { canRecordProduction, plantIdsForQuery } from "@/lib/plants/scope";
import { ProductionEntryForm } from "@/components/production/production-entry-form";

export const metadata: Metadata = { title: "Production entry" };

export default async function NewEntryPage() {
  const context = await requireTenantContext();
  if (!canRecordProduction(context.role)) {
    return <p className="text-sm text-slate-400">Viewers cannot record production.</p>;
  }
  const { scope } = await loadPlantScope(context);
  const plantFilter = plantIdsForQuery(scope);
  if (plantFilter && plantFilter.length === 0) {
    return <p className="text-sm text-slate-400">No plant access.</p>;
  }

  const orders = await prisma.productionOrder.findMany({
    where: {
      organizationId: context.organizationId,
      lifecycleStatus: { notIn: ["CANCELLED"] },
      ...(plantFilter ? { plantId: { in: plantFilter } } : {}),
    },
    include: {
      processes: { orderBy: { sequence: "asc" } },
      requestedSpecialActivities: { include: { specialActivity: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const processesByOrder = Object.fromEntries(
    orders.map((order) => [
      order.id,
      order.processes.map((process) => ({
        id: process.id,
        label: `${process.sequence}. ${process.processName}`,
      })),
    ]),
  );

  const specialActivitiesByOrder = Object.fromEntries(
    orders.map((order) => [
      order.id,
      order.specialActivitiesRequested
        ? order.requestedSpecialActivities.map((row) => ({
            id: row.specialActivity.id,
            name: row.specialActivity.name,
          }))
        : [],
    ]),
  );

  return (
    <main className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Daily production entry</h1>
      <ProductionEntryForm
        orders={orders.map((order) => ({ id: order.id, orderNumber: order.orderNumber }))}
        processesByOrder={processesByOrder}
        specialActivitiesByOrder={specialActivitiesByOrder}
      />
    </main>
  );
}
