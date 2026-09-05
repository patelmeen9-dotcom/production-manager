import { prisma } from "@/lib/db";
import { parseOrganizationSettings } from "@/lib/organization-settings";
import type { OrderEvaluation } from "@/lib/production/engine";
import { evaluateOrderLines } from "@/lib/production/evaluate-lines";

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
      expectedDays?: number | null;
      processId?: string | null;
      productionOrderLineId?: string | null;
    }[];
    lines?: {
      id: string;
      quantity: number;
      product?: { name: string } | null;
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

  const masterProcessIds = [
    ...new Set(
      input.orders.flatMap((order) =>
        order.processes.map((process) => process.processId).filter((id): id is string => Boolean(id)),
      ),
    ),
  ];
  const masterRates =
    masterProcessIds.length > 0
      ? await prisma.process.findMany({
          where: { organizationId: input.organizationId, id: { in: masterProcessIds } },
          select: { id: true, unitsPerDay: true },
        })
      : [];
  const unitsByProcessId = new Map(masterRates.map((row) => [row.id, row.unitsPerDay]));

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
    const processesByLine = new Map<string, typeof order.processes>();
    for (const process of order.processes) {
      const lineId = process.productionOrderLineId ?? "__legacy__";
      const list = processesByLine.get(lineId) ?? [];
      list.push(process);
      processesByLine.set(lineId, list);
    }

    const lineMeta = new Map((order.lines ?? []).map((line) => [line.id, line]));
    const lines =
      processesByLine.size > 0
        ? [...processesByLine.entries()].map(([lineId, processes]) => {
            const meta = lineMeta.get(lineId);
            const label = meta?.product?.name;
            return {
              id: lineId,
              quantity: meta?.quantity ?? processes[0]?.plannedQuantity ?? order.quantity,
              label,
              processes: processes.map((process) => ({
                id: process.id,
                sequence: process.sequence,
                processName: process.processName,
                processCode: process.processCode,
                plannedQuantity: process.plannedQuantity,
                expectedDays: process.expectedDays ?? null,
                unitsPerDay: process.processId ? (unitsByProcessId.get(process.processId) ?? null) : null,
              })),
            };
          })
        : [
            {
              id: "__empty__",
              quantity: order.quantity,
              processes: [],
            },
          ];

    result.set(
      order.id,
      evaluateOrderLines({
        orderQuantity: order.quantity,
        effectiveStartDate: order.effectiveStartDate,
        resolvedDueDate: order.resolvedDueDate,
        lifecycleStatus: order.lifecycleStatus,
        lines,
        entries: entriesByOrder.get(order.id) ?? [],
        firstEntryDate: firstByOrder.get(order.id) ?? null,
        asOfDate: input.asOfDate,
        settings,
      }),
    );
  }

  return result;
}
