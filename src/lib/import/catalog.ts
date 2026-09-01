import { prisma } from "@/lib/db";
import { canUseAllPlantsView } from "@/lib/plants/scope";
import type { AuthContext } from "@/lib/authz";
import { normalizeCode } from "@/lib/import/parse";
import type { OrgCatalog } from "@/lib/import/validate";

/**
 * Loads org masters and order snapshots for import validation.
 * Production entry history is aggregated per order/process (sums only) so multi-year
 * transaction tables are not pulled into memory row-by-row.
 */
export async function loadOrgCatalog(context: AuthContext & { organizationId: string }): Promise<OrgCatalog> {
  const [plants, clients, products, processes, specialActivities, mappings, orders, entrySums] =
    await Promise.all([
      prisma.plant.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, code: true, name: true },
      }),
      prisma.client.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, code: true, name: true },
      }),
      prisma.product.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, code: true, name: true },
      }),
      prisma.process.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, code: true, name: true },
      }),
      prisma.specialActivity.findMany({
        where: { organizationId: context.organizationId },
        select: { id: true, code: true, name: true },
      }),
      prisma.plantProductProcessMapping.findMany({
        where: { organizationId: context.organizationId, isActive: true },
        select: {
          sequence: true,
          plant: { select: { code: true } },
          product: { select: { code: true } },
          process: { select: { code: true } },
        },
        orderBy: { sequence: "asc" },
      }),
      prisma.productionOrder.findMany({
        where: { organizationId: context.organizationId },
        select: {
          id: true,
          orderNumber: true,
          quantity: true,
          lifecycleStatus: true,
          plant: { select: { code: true } },
          processes: {
            select: {
              id: true,
              processCode: true,
              sequence: true,
              processName: true,
              plannedQuantity: true,
            },
            orderBy: { sequence: "asc" },
          },
        },
      }),
      prisma.productionEntry.groupBy({
        by: ["productionOrderId", "orderProcessId"],
        where: { organizationId: context.organizationId },
        _sum: { quantity: true },
      }),
    ]);

  const mappingGroups = new Map<string, string[]>();
  for (const row of mappings) {
    const key = `${normalizeCode(row.plant.code)}:${normalizeCode(row.product.code)}`;
    const list = mappingGroups.get(key) ?? [];
    list.push(normalizeCode(row.process.code));
    mappingGroups.set(key, list);
  }

  const entriesByOrder = new Map<string, { orderProcessId: string; quantity: number }[]>();
  for (const row of entrySums) {
    const quantity = row._sum.quantity ?? 0;
    if (quantity <= 0) {
      continue;
    }
    const list = entriesByOrder.get(row.productionOrderId) ?? [];
    list.push({ orderProcessId: row.orderProcessId, quantity });
    entriesByOrder.set(row.productionOrderId, list);
  }

  let grantedPlantCodes: Set<string> | null = null;
  if (!canUseAllPlantsView(context.role)) {
    const grants = await prisma.userPlantAccess.findMany({
      where: { organizationId: context.organizationId, userId: context.userId },
      select: { plant: { select: { code: true } } },
    });
    grantedPlantCodes = new Set(grants.map((grant) => normalizeCode(grant.plant.code)));
  }

  return {
    plants,
    clients,
    products,
    processes,
    specialActivities,
    mappings: [...mappingGroups.entries()].map(([key, processCodes]) => {
      const [plantCode, productCode] = key.split(":");
      return { plantCode, productCode, processCodes };
    }),
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      plantCode: order.plant.code,
      quantity: order.quantity,
      lifecycleStatus: order.lifecycleStatus,
      processes: order.processes,
      entries: entriesByOrder.get(order.id) ?? [],
    })),
    grantedPlantCodes,
  };
}
