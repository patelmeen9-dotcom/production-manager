import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireGrantedPlant } from "@/lib/plants/access";
import { canManageMasters, canRecordProduction } from "@/lib/plants/scope";
import { formatDateOnly } from "@/lib/orders/date-rules";
import { formatOrderLineLabel } from "@/lib/orders/line-label";
import { evaluateMaterialUsage } from "@/lib/orders/materials";
import { evaluateOrganizationOrders } from "@/lib/production/evaluate-orders";
import { displayStatusLabel } from "@/lib/production/engine";
import { buildEntryLinesByOrder } from "@/lib/production/entry-form-data";
import { ProductionEntryForm } from "@/components/production/production-entry-form";
import { SpecialActivityEntryForm } from "@/components/production/special-activity-entry-form";
import { SavedBanner } from "@/components/ui/saved-banner";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const { id } = await params;
  const query = await searchParams;
  const order = await prisma.productionOrder.findFirst({
    where: { id, organizationId: context.organizationId },
    include: {
      client: true,
      product: true,
      plant: true,
      lines: {
        include: {
          product: true,
          categorySelections: {
            include: {
              productCategory: true,
              selectedOptions: { include: { categoryOption: true } },
            },
          },
          materials: {
            include: { stages: true },
          },
        },
        orderBy: { lineNumber: "asc" },
      },
      processes: {
        include: {
          orderLine: { include: { product: { select: { name: true } } } },
        },
        orderBy: [{ productionOrderLineId: "asc" }, { sequence: "asc" }],
      },
      requestedSpecialActivities: { include: { specialActivity: true } },
      productionEntries: {
        include: {
          createdBy: { select: { name: true } },
          orderProcess: {
            include: { orderLine: { include: { product: { select: { name: true } } } } },
          },
          specialActivity: true,
        },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        take: 50,
      },
      specialActivityEntries: {
        include: { specialActivity: true, createdBy: { select: { name: true } } },
        orderBy: { entryDate: "desc" },
        take: 20,
      },
    },
  });
  if (!order) {
    notFound();
  }
  await requireGrantedPlant(context, order.plantId);

  const asOf = new Date();
  const evaluations = await evaluateOrganizationOrders({
    organizationId: context.organizationId,
    orders: [
      {
        ...order,
        lines: order.lines.map((line) => ({
          id: line.id,
          quantity: line.quantity,
          product: line.product,
        })),
      },
    ],
    asOfDate: asOf,
  });
  const evaluation = evaluations.get(order.id);
  const entrySums = new Map<string, number>();
  for (const entry of order.productionEntries) {
    entrySums.set(entry.orderProcessId, (entrySums.get(entry.orderProcessId) ?? 0) + entry.quantity);
  }

  const requestedActivities = order.requestedSpecialActivities.map((row) => ({
    id: row.specialActivity.id,
    name: row.specialActivity.name,
  }));
  const productSummary =
    order.lines.length > 0 ? order.lines.map((line) => formatOrderLineLabel(line)).join(", ") : order.product.name;
  const manage = canManageMasters(context.role);

  const materialWarnings: string[] = [];
  for (const line of order.lines) {
    for (const material of line.materials) {
      const usage = evaluateMaterialUsage({
        name: material.name,
        quantityPerUnit: material.quantityPerUnit,
        quantityReceived: material.quantityReceived,
        lineQuantity: line.quantity,
        stageCumulatives: material.stages.map((stage) => entrySums.get(stage.orderProcessId) ?? 0),
      });
      if (usage.warning) {
        materialWarnings.push(usage.warning);
      }
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">{order.orderNumber}</h1>
          <p className="text-sm text-slate-400">
            {order.client.name} · {productSummary} · {order.plant.name}
          </p>
        </div>
        {manage ? (
          <Link className="text-sm text-sky-400" href={`/orders/${order.id}/edit`}>
            Edit order
          </Link>
        ) : null}
      </div>
      <SavedBanner message={query.saved} />
      {materialWarnings.length > 0 ? (
        <section className="rounded-lg border border-amber-700/60 bg-amber-950/30 p-4 text-sm text-amber-200">
          <p className="font-medium">Material warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {materialWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="rounded-lg border border-slate-800 p-4 text-sm text-slate-200">
        <p>Total quantity: {order.quantity}</p>
        <p>Order date: {formatDateOnly(order.orderDate)}</p>
        <p>Effective start: {formatDateOnly(order.effectiveStartDate)}</p>
        <p>Due date: {formatDateOnly(order.resolvedDueDate)}</p>
        <p>
          Special activities requested:{" "}
          {order.specialActivitiesRequested
            ? requestedActivities.map((activity) => activity.name).join(", ") || "Yes"
            : "No"}
        </p>
        <p>Lifecycle (stored): {order.lifecycleStatus}</p>
        {evaluation ? (
          <>
            <p>Current stage: {evaluation.currentStageName ?? "—"}</p>
            <p>
              Finished goods: {evaluation.completedQuantity} / {order.quantity}
            </p>
            <p>Pending: {evaluation.remainingQuantity}</p>
            <p>Progress: {evaluation.progressPercent.toFixed(1)}%</p>
            <p>Status: {displayStatusLabel(evaluation.displayStatus)}</p>
          </>
        ) : null}
      </section>
      <section>
        <h2 className="text-lg font-medium text-white">Order lines</h2>
        <ul className="mt-2 space-y-3 text-sm text-slate-200">
          {order.lines.map((line) => (
            <li key={line.id} className="rounded border border-slate-800 p-3">
              <p>
                Line {line.lineNumber}: {formatOrderLineLabel(line)} → {line.quantity}
                {line.product.details ? ` · ${line.product.details}` : ""}
              </p>
              {line.remarks ? <p className="text-slate-400">Remarks: {line.remarks}</p> : null}
              {line.materials.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {line.materials.map((material) => {
                    const usage = evaluateMaterialUsage({
                      name: material.name,
                      quantityPerUnit: material.quantityPerUnit,
                      quantityReceived: material.quantityReceived,
                      lineQuantity: line.quantity,
                      stageCumulatives: material.stages.map((stage) => entrySums.get(stage.orderProcessId) ?? 0),
                    });
                    return (
                      <li key={material.id}>
                        {material.name}: need {usage.totalNeeded} ({material.quantityPerUnit}/unit), received{" "}
                        {material.quantityReceived}, used {usage.used}, available {usage.available}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-medium text-white">Process snapshot</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-200">
          {(evaluation?.stages ?? order.processes).map((step) => {
            const lineLabel =
              "orderLine" in step && step.orderLine ? `${step.orderLine.product.name} · ` : "";
            return (
              <li key={step.id}>
                {lineLabel}
                {"processName" in step ? step.processName : ""}{" "}
                {"cumulative" in step
                  ? `${step.cumulative} / ${step.plannedQuantity} (${step.percentComplete.toFixed(0)}%)`
                  : `planned ${step.plannedQuantity}`}
                {"expectedDays" in step && step.expectedDays != null
                  ? ` · expected ${step.expectedDays} day${step.expectedDays === 1 ? "" : "s"}`
                  : ""}
                {"unitsPerDay" in step && step.unitsPerDay != null
                  ? ` · ${step.unitsPerDay}/day (master)`
                  : ""}
              </li>
            );
          })}
        </ol>
      </section>
      <section>
        <h2 className="text-lg font-medium text-white">Production history</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Line</th>
              <th className="p-2">Stage</th>
              <th className="p-2">Special activity</th>
              <th className="p-2">Qty</th>
              <th className="p-2">User</th>
            </tr>
          </thead>
          <tbody>
            {order.productionEntries.map((entry) => (
              <tr key={entry.id} className="border-t border-slate-800">
                <td className="p-2">{formatDateOnly(entry.entryDate)}</td>
                <td className="p-2">{entry.orderProcess.orderLine?.product.name ?? "—"}</td>
                <td className="p-2">{entry.orderProcess.processName}</td>
                <td className="p-2">{entry.specialActivity?.name ?? "—"}</td>
                <td className="p-2">{entry.quantity}</td>
                <td className="p-2">{entry.createdBy.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {canRecordProduction(context.role) ? (
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-white">Add incremental production</h2>
          <ProductionEntryForm
            defaultOrderId={order.id}
            orders={[{ id: order.id, orderNumber: order.orderNumber }]}
            linesByOrder={buildEntryLinesByOrder([
              {
                id: order.id,
                lines: order.lines.map((line) => ({
                  ...line,
                  processes: order.processes.filter((process) => process.productionOrderLineId === line.id),
                })),
              },
            ])}
            activitiesByOrder={{
              [order.id]: requestedActivities.map((activity) => ({
                value: `activity:${activity.id}`,
                label: activity.name,
              })),
            }}
            showBackToList={false}
          />
          <h2 className="text-lg font-medium text-white">Special activity / rework (legacy form)</h2>
          <p className="text-xs text-slate-500">Prefer the combined stage dropdown above. This form remains for related-stage rework notes.</p>
          <SpecialActivityEntryForm
            orderId={order.id}
            activities={requestedActivities}
            processes={order.processes.map((process) => ({
              id: process.id,
              label: `${process.orderLine.product.name} · ${process.processName}`,
            }))}
          />
        </section>
      ) : null}
      {order.specialActivityEntries.length > 0 ? (
        <section>
          <h2 className="text-lg font-medium text-white">Special activity history</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {order.specialActivityEntries.map((entry) => (
              <li key={entry.id}>
                {formatDateOnly(entry.entryDate)} · {entry.specialActivity.name} · {entry.quantity} · {entry.createdBy.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p>
        <Link className="text-sm text-sky-400" href="/orders">
          Back to orders
        </Link>
      </p>
    </main>
  );
}
