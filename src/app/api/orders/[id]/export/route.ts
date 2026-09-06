import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireGrantedPlant } from "@/lib/plants/access";
import { formatDateOnly } from "@/lib/orders/date-rules";
import { buildSingleOrderCsv } from "@/lib/orders/export-csv";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireTenantContext();
  const { id } = await context.params;
  const order = await prisma.productionOrder.findFirst({
    where: { id, organizationId: auth.organizationId },
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
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await requireGrantedPlant(auth, order.plantId);

  const csv = buildSingleOrderCsv({
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
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${order.orderNumber.replaceAll(/[^\w.-]+/g, "_")}-lines.csv"`,
    },
  });
}
