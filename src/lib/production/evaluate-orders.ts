import { prisma } from "@/lib/db";
import { parseOrganizationSettings } from "@/lib/organization-settings";
import { evaluateOrder, type OrderEvaluation } from "@/lib/production/engine";

export async function evaluateOrganizationOrders(input: {
  organizationId: string;
  orders: {
    id: string;
    quantity: number;
    effectiveStartDate: Date;
    resolvedDueDate: Date;
    lifecycleStatus: string;
    processes: {
      id: string;
      sequence: number;
      processName: string;
      processCode: string;
      plannedQuantity: number;
    }[];
  }[];
  asOfDate: Date;
}): Promise<Map<string, OrderEvaluation>> {
  const organization = await prisma.organization.findFirstOrThrow({
    where: { id: input.organizationId },
    select: { settings: true },
  });
  const settings = parseOrganizationSettings(organization.settings);
  const ids = input.orders.map((order) => order.id);
  const result = new Map<string, OrderEvaluation>();
  if (ids.length === 0) {
    return result;
  }

  const grouped = await prisma.productionEntry.groupBy({
    by: ["productionOrderId", "orderProcessId"],
    where: { organizationId: input.organizationId, productionOrderId: { in: ids } },
    _sum: { quantity: true },
  });
  const firstDates = await prisma.productionEntry.groupBy({
    by: ["productionOrderId"],
    where: { organizationId: input.organizationId, productionOrderId: { in: ids } },
    _min: { entryDate: true },
  });
  const firstByOrder = new Map(firstDates.map((row) => [row.productionOrderId, row._min.entryDate]));
  const entriesByOrder = new Map<string, { orderProcessId: string; quantity: number }[]>();
  for (const row of grouped) {
    const quantity = row._sum.quantity ?? 0;
    if (quantity <= 0) {
      continue;
    }
    const list = entriesByOrder.get(row.productionOrderId) ?? [];
    list.push({ orderProcessId: row.orderProcessId, quantity });
    entriesByOrder.set(row.productionOrderId, list);
  }

  for (const order of input.orders) {
    result.set(
      order.id,
      evaluateOrder({
        orderQuantity: order.quantity,
        effectiveStartDate: order.effectiveStartDate,
        resolvedDueDate: order.resolvedDueDate,
        lifecycleStatus: order.lifecycleStatus,
        processes: order.processes,
        entries: entriesByOrder.get(order.id) ?? [],
        firstEntryDate: firstByOrder.get(order.id) ?? null,
        asOfDate: input.asOfDate,
        settings,
      }),
    );
  }

  return result;
}
