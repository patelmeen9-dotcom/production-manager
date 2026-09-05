import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";
import { requireGrantedPlant } from "@/lib/plants/access";
import { formatOrderLineLabel } from "@/lib/orders/line-label";
import { ProductionOrderSafeEditForm } from "@/components/orders/production-order-safe-edit-form";

export const metadata: Metadata = { title: "Edit order" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await requireMasterWriter();
  const { id } = await params;
  const order = await prisma.productionOrder.findFirst({
    where: { id, organizationId: context.organizationId },
    include: {
      lines: {
        include: {
          product: true,
          categorySelections: {
            include: {
              productCategory: true,
              selectedOptions: { include: { categoryOption: true } },
            },
          },
          materials: true,
        },
        orderBy: { lineNumber: "asc" },
      },
      productionEntries: { take: 1, select: { id: true } },
    },
  });
  if (!order) {
    notFound();
  }
  await requireGrantedPlant(context, order.plantId);

  const hasEntries = order.productionEntries.length > 0 || order.lifecycleStatus !== "NOT_STARTED";

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Edit order {order.orderNumber}</h1>
        <Link className="text-sm text-sky-400" href={`/orders/${order.id}`}>
          Back to order
        </Link>
      </div>
      {hasEntries ? (
        <ProductionOrderSafeEditForm
          orderId={order.id}
          remarks={order.remarks}
          priority={order.priority}
          lines={order.lines.map((line) => ({
            id: line.id,
            label: `Line ${line.lineNumber}: ${formatOrderLineLabel(line)}`,
            remarks: line.remarks,
          }))}
          materials={order.lines.flatMap((line) =>
            line.materials.map((material) => ({
              id: material.id,
              label: `${formatOrderLineLabel(line)} · ${material.name}`,
              quantityReceived: material.quantityReceived,
              totalNeeded: material.quantityPerUnit * line.quantity,
            })),
          )}
        />
      ) : (
        <div className="space-y-3 rounded-lg border border-slate-800 p-4 text-sm text-slate-300">
          <p>
            Full structural edit (lines, processes, categories, materials) for orders with no production yet will replace
            the create flow. For now, use safe fields below or delete and recreate if you need a full rewrite.
          </p>
          <ProductionOrderSafeEditForm
            orderId={order.id}
            remarks={order.remarks}
            priority={order.priority}
            lines={order.lines.map((line) => ({
              id: line.id,
              label: `Line ${line.lineNumber}: ${formatOrderLineLabel(line)}`,
              remarks: line.remarks,
            }))}
            materials={order.lines.flatMap((line) =>
              line.materials.map((material) => ({
                id: material.id,
                label: `${formatOrderLineLabel(line)} · ${material.name}`,
                quantityReceived: material.quantityReceived,
                totalNeeded: material.quantityPerUnit * line.quantity,
              })),
            )}
          />
        </div>
      )}
    </main>
  );
}
