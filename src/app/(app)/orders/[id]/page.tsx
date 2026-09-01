import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { requireGrantedPlant } from "@/lib/plants/access";
import { canRecordProduction } from "@/lib/plants/scope";
import { formatDateOnly } from "@/lib/orders/date-rules";
import { evaluateOrganizationOrders } from "@/lib/production/evaluate-orders";
import { displayStatusLabel } from "@/lib/production/engine";
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
      processes: { orderBy: { sequence: "asc" } },
      requestedSpecialActivities: { include: { specialActivity: true } },
      productionEntries: {
        include: {
          createdBy: { select: { name: true } },
          orderProcess: true,
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
    orders: [order],
    asOfDate: asOf,
  });
  const evaluation = evaluations.get(order.id);

  const requestedActivities = order.requestedSpecialActivities.map((row) => ({
    id: row.specialActivity.id,
    name: row.specialActivity.name,
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{order.orderNumber}</h1>
        <p className="text-sm text-slate-400">
          {order.client.name} · {order.product.name} · {order.plant.name}
        </p>
      </div>
      <SavedBanner message={query.saved} />
      <section className="rounded-lg border border-slate-800 p-4 text-sm text-slate-200">
        <p>Quantity: {order.quantity}</p>
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
            <p>Finished goods: {evaluation.completedQuantity} / {order.quantity}</p>
            <p>Pending: {evaluation.remainingQuantity}</p>
            <p>Progress: {evaluation.progressPercent.toFixed(1)}%</p>
            <p>Status: {displayStatusLabel(evaluation.displayStatus)}</p>
            <p>
              Expected completion:{" "}
              {evaluation.estimatedCompletionDate ? formatDateOnly(evaluation.estimatedCompletionDate) : "Not enough rate data"}
            </p>
          </>
        ) : null}
      </section>
      <section>
        <h2 className="text-lg font-medium text-white">Process snapshot</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-200">
          {(evaluation?.stages ?? order.processes).map((step) => (
            <li key={step.id}>
              {"processName" in step ? step.processName : ""}{" "}
              {"cumulative" in step
                ? `${step.cumulative} / ${step.plannedQuantity} (${step.percentComplete.toFixed(0)}%)`
                : `planned ${step.plannedQuantity}`}
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="text-lg font-medium text-white">Production history</h2>
        <table className="mt-2 w-full text-left text-sm">
            <thead className="text-slate-400">
            <tr>
              <th className="p-2">Date</th>
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
            processesByOrder={{
              [order.id]: order.processes.map((process) => ({
                id: process.id,
                label: `${process.sequence}. ${process.processName}`,
              })),
            }}
            specialActivitiesByOrder={{
              [order.id]: requestedActivities,
            }}
          />
          <h2 className="text-lg font-medium text-white">Special activity / rework</h2>
          <p className="text-xs text-slate-500">Does not subtract or rewrite historical production entries.</p>
          <SpecialActivityEntryForm
            orderId={order.id}
            activities={requestedActivities}
            processes={order.processes.map((process) => ({
              id: process.id,
              label: process.processName,
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
