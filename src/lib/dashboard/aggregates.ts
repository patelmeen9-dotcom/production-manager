/**
 * Dashboard production aggregates.
 * Charts always GROUP BY in PostgreSQL with org + date (+ plant) filters.
 * Do not load multi-year ProductionEntry rows into the browser.
 * Future growth path (not implemented yet): daily/weekly/monthly summary tables + optional cache.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

function plantFilter(plantIds: string[] | null) {
  if (plantIds === null) {
    return Prisma.empty;
  }
  if (plantIds.length === 0) {
    return Prisma.sql`AND FALSE`;
  }
  return Prisma.sql`AND e."plantId" IN (${Prisma.join(plantIds)})`;
}

const lastStageOnly = Prisma.sql`AND pop.sequence = (
  SELECT MAX(p2.sequence) FROM "ProductionOrderProcess" p2
  WHERE p2."productionOrderLineId" = pop."productionOrderLineId"
)`;

type ScopeInput = {
  organizationId: string;
  from: Date;
  to: Date;
  plantIds: string[] | null;
  clientId?: string;
  productId?: string;
  orderId?: string;
  processId?: string;
};

/**
 * Finished-goods units in the date range, grouped by client × product
 * (e.g. Client X → 5 Doors, 3 Chairs).
 */
export async function productionByClientProduct(
  input: ScopeInput,
): Promise<{ clientId: string; clientName: string; productId: string; productName: string; quantity: number }[]> {
  const rows = await prisma.$queryRaw<
    {
      clientId: string;
      clientName: string;
      productId: string;
      productName: string;
      quantity: bigint | number;
    }[]
  >`
    SELECT o."clientId" AS "clientId",
           c.name AS "clientName",
           ol."productId" AS "productId",
           p.name AS "productName",
           COALESCE(SUM(e.quantity), 0)::int AS quantity
    FROM "ProductionEntry" e
    INNER JOIN "ProductionOrder" o ON o.id = e."productionOrderId"
    INNER JOIN "Client" c ON c.id = o."clientId"
    INNER JOIN "ProductionOrderProcess" pop ON pop.id = e."orderProcessId"
    INNER JOIN "ProductionOrderLine" ol ON ol.id = pop."productionOrderLineId"
    INNER JOIN "Product" p ON p.id = ol."productId"
    WHERE e."organizationId" = ${input.organizationId}
      AND e."entryDate" >= ${input.from}
      AND e."entryDate" <= ${input.to}
      ${lastStageOnly}
      ${plantFilter(input.plantIds)}
      ${input.clientId ? Prisma.sql`AND o."clientId" = ${input.clientId}` : Prisma.empty}
      ${input.productId ? Prisma.sql`AND ol."productId" = ${input.productId}` : Prisma.empty}
      ${input.orderId ? Prisma.sql`AND e."productionOrderId" = ${input.orderId}` : Prisma.empty}
    GROUP BY o."clientId", c.name, ol."productId", p.name
    ORDER BY c.name, p.name
  `;

  return rows.map((row) => ({
    clientId: row.clientId,
    clientName: row.clientName,
    productId: row.productId,
    productName: row.productName,
    quantity: Number(row.quantity),
  }));
}

/**
 * Units completed per process stage in the date range (all stages, not only last).
 */
export async function productionByProcess(
  input: ScopeInput,
): Promise<{ processCode: string; processName: string; sequenceHint: number; quantity: number }[]> {
  const rows = await prisma.$queryRaw<
    { processCode: string; processName: string; sequenceHint: number; quantity: bigint | number }[]
  >`
    SELECT pop."processCode" AS "processCode",
           pop."processName" AS "processName",
           MIN(pop.sequence)::int AS "sequenceHint",
           COALESCE(SUM(e.quantity), 0)::int AS quantity
    FROM "ProductionEntry" e
    INNER JOIN "ProductionOrder" o ON o.id = e."productionOrderId"
    INNER JOIN "ProductionOrderProcess" pop ON pop.id = e."orderProcessId"
    WHERE e."organizationId" = ${input.organizationId}
      AND e."entryDate" >= ${input.from}
      AND e."entryDate" <= ${input.to}
      ${plantFilter(input.plantIds)}
      ${input.clientId ? Prisma.sql`AND o."clientId" = ${input.clientId}` : Prisma.empty}
      ${input.productId ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "ProductionOrderLine" ol
        WHERE ol."productionOrderId" = o.id AND ol."productId" = ${input.productId}
      )` : Prisma.empty}
      ${input.orderId ? Prisma.sql`AND e."productionOrderId" = ${input.orderId}` : Prisma.empty}
      ${input.processId ? Prisma.sql`AND pop."processId" = ${input.processId}` : Prisma.empty}
    GROUP BY pop."processCode", pop."processName"
    ORDER BY MIN(pop.sequence), pop."processName"
  `;

  return rows.map((row) => ({
    processCode: row.processCode,
    processName: row.processName,
    sequenceHint: Number(row.sequenceHint),
    quantity: Number(row.quantity),
  }));
}

/**
 * Per client → order → process quantities entered in the date range
 * (e.g. Client X / Order 1 → Cutting:50, Framing:20).
 */
export async function productionByClientOrderProcess(input: ScopeInput): Promise<
  {
    clientId: string;
    clientName: string;
    orderId: string;
    orderNumber: string;
    productName: string;
    processCode: string;
    processName: string;
    sequence: number;
    quantity: number;
  }[]
> {
  const rows = await prisma.$queryRaw<
    {
      clientId: string;
      clientName: string;
      orderId: string;
      orderNumber: string;
      productName: string;
      processCode: string;
      processName: string;
      sequence: number;
      quantity: bigint | number;
    }[]
  >`
    SELECT o."clientId" AS "clientId",
           c.name AS "clientName",
           o.id AS "orderId",
           o."orderNumber" AS "orderNumber",
           p.name AS "productName",
           pop."processCode" AS "processCode",
           pop."processName" AS "processName",
           pop.sequence AS sequence,
           COALESCE(SUM(e.quantity), 0)::int AS quantity
    FROM "ProductionEntry" e
    INNER JOIN "ProductionOrder" o ON o.id = e."productionOrderId"
    INNER JOIN "Client" c ON c.id = o."clientId"
    INNER JOIN "ProductionOrderProcess" pop ON pop.id = e."orderProcessId"
    INNER JOIN "ProductionOrderLine" ol ON ol.id = pop."productionOrderLineId"
    INNER JOIN "Product" p ON p.id = ol."productId"
    WHERE e."organizationId" = ${input.organizationId}
      AND e."entryDate" >= ${input.from}
      AND e."entryDate" <= ${input.to}
      ${plantFilter(input.plantIds)}
      ${input.clientId ? Prisma.sql`AND o."clientId" = ${input.clientId}` : Prisma.empty}
      ${input.productId ? Prisma.sql`AND ol."productId" = ${input.productId}` : Prisma.empty}
      ${input.orderId ? Prisma.sql`AND e."productionOrderId" = ${input.orderId}` : Prisma.empty}
      ${input.processId ? Prisma.sql`AND pop."processId" = ${input.processId}` : Prisma.empty}
    GROUP BY o."clientId", c.name, o.id, o."orderNumber", p.name,
             pop."processCode", pop."processName", pop.sequence
    ORDER BY c.name, o."orderNumber", pop.sequence
  `;

  return rows.map((row) => ({
    clientId: row.clientId,
    clientName: row.clientName,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    productName: row.productName,
    processCode: row.processCode,
    processName: row.processName,
    sequence: Number(row.sequence),
    quantity: Number(row.quantity),
  }));
}
