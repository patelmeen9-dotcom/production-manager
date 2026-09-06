import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";
import { plantIdsForQuery } from "@/lib/plants/scope";
import { formatDateOnly } from "@/lib/orders/date-rules";
import { buildOrderLinesCsv } from "@/lib/orders/export-csv";

export async function GET() {
  const context = await requireTenantContext();
  const { scope } = await loadPlantScope(context);
  const plantFilter = plantIdsForQuery(scope);
  if (plantFilter && plantFilter.length === 0) {
    return NextResponse.json({ error: "No plant access." }, { status: 403 });
  }

  const orders = await prisma.productionOrder.findMany({
    where: {
      organizationId: context.organizationId,
      ...(plantFilter ? { plantId: { in: plantFilter } } : {}),
    },
    include: {
      client: { select: { name: true } },
      plant: { select: { name: true } },
      lines: {
        include: {
          product: {
            include: {
              categoryAssignments: { include: { productCategory: { select: { id: true, name: true } } } },
            },
          },
          categorySelections: {
            include: {
              productCategory: { select: { id: true, name: true } },
              selectedOptions: { include: { categoryOption: { select: { name: true } } } },
            },
          },
        },
        orderBy: { lineNumber: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const csv = buildOrderLinesCsv({
    includeOrderColumns: true,
    orders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      clientName: order.client.name,
      plantName: order.plant.name,
      quantity: order.quantity,
      orderDate: formatDateOnly(order.orderDate),
      startDate: formatDateOnly(order.effectiveStartDate),
      dueDate: formatDateOnly(order.resolvedDueDate),
      lifecycleStatus: order.lifecycleStatus,
      remarks: order.remarks,
      lines: order.lines,
    })),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="production-orders.csv"',
    },
  });
}
