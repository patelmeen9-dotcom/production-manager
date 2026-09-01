import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Factory, TrendingUp } from "lucide-react";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";
import { plantIdsForQuery } from "@/lib/plants/scope";
import { addUtcDays, formatDateOnly, parseDateOnly } from "@/lib/orders/date-rules";
import { evaluateOrganizationOrders } from "@/lib/production/evaluate-orders";
import {
  productionByClientOrderProcess,
  productionByClientProduct,
  productionByProcess,
} from "@/lib/dashboard/aggregates";
import { aggregateStageProgress, orderStageProgress } from "@/lib/dashboard/stage-progress";
import {
  STATUS_SEVERITY,
  buildDashboardQuery,
  matchesStatusGroup,
  parseStatusGroup,
  type StatusGroup,
} from "@/lib/dashboard/status-groups";
import { ClientProductChart, ProcessOutputChart, StagePipelineChart } from "@/components/dashboard/charts";
import { LiveTrackingTable, type LiveOrderRow } from "@/components/dashboard/live-tracking";
import {
  WeeklyOrderStagePanel,
  type WeeklyOrderStageRow,
} from "@/components/dashboard/weekly-order-stages";

export const metadata: Metadata = { title: "Dashboard" };

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysToDue(dueDate: Date, asOf: Date): number {
  return Math.round((dueDate.getTime() - asOf.getTime()) / 86_400_000);
}

function KpiCard(props: {
  label: string;
  value: number;
  sub: string;
  tone: "delayed" | "warn" | "good" | "neutral" | "accent";
  href: string;
  active: boolean;
  viewAllHref: string;
  icon: React.ReactNode;
}) {
  const toneBorder = {
    delayed: "border-l-delayed",
    warn: "border-l-warn",
    good: "border-l-on-time",
    neutral: "border-l-line-strong",
    accent: "border-l-accent",
  }[props.tone];

  return (
    <div
      className={`min-w-[140px] flex-1 rounded border border-line border-l-[3px] bg-panel p-4 ${toneBorder} ${
        props.active ? "ring-2 ring-ring" : ""
      }`}
    >
      <Link href={props.href} className="block">
        <div className="mb-2 flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-ink-soft">{props.label}</p>
          <span className="text-ink-soft">{props.icon}</span>
        </div>
        <p className="font-mono text-[28px] font-semibold leading-none text-ink">{props.value}</p>
        <p className="mt-1.5 text-[11.5px] text-ink-soft">{props.sub}</p>
        <p className="mt-2 text-[11px] text-accent">{props.active ? "Click to clear filter" : "Filter live tracking"}</p>
      </Link>
      <Link href={props.viewAllHref} className="mt-2 inline-block text-[11px] font-medium text-accent hover:underline">
        View all →
      </Link>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const { scope, plants } = await loadPlantScope(context);
  const scopedPlantIds = plantIdsForQuery(scope);
  if (scopedPlantIds && scopedPlantIds.length === 0) {
    return <p className="text-sm text-ink-soft">No plant access is assigned to this user.</p>;
  }

  const requestedPlant = get("plantId");
  const plantIds =
    requestedPlant && (!scopedPlantIds || scopedPlantIds.includes(requestedPlant))
      ? [requestedPlant]
      : scopedPlantIds;

  const clientId = get("clientId") || undefined;
  const productId = get("productId") || undefined;
  const orderId = get("orderId") || undefined;
  const processId = get("processId") || undefined;
  const statusGroup = parseStatusGroup(get("statusGroup"));
  const asOf = todayUtc();

  const from = get("from") ? parseDateOnly(get("from")!) : addUtcDays(asOf, -6);
  const to = get("to") ? parseDateOnly(get("to")!) : asOf;

  const currentQuery: Record<string, string | undefined> = {
    plantId: requestedPlant,
    clientId,
    productId,
    orderId,
    processId,
    from: formatDateOnly(from),
    to: formatDateOnly(to),
    statusGroup: statusGroup && statusGroup !== "total" ? statusGroup : undefined,
  };

  const [clients, products, processes, orders, organization] = await Promise.all([
    prisma.client.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.process.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.productionOrder.findMany({
      where: {
        organizationId: context.organizationId,
        ...(plantIds ? { plantId: { in: plantIds } } : {}),
        ...(clientId ? { clientId } : {}),
        ...(productId ? { productId } : {}),
        ...(orderId ? { id: orderId } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        quantity: true,
        clientId: true,
        effectiveStartDate: true,
        resolvedDueDate: true,
        lifecycleStatus: true,
        client: { select: { name: true } },
        product: { select: { name: true } },
        plant: { select: { name: true } },
        processes: {
          select: {
            id: true,
            sequence: true,
            processName: true,
            processCode: true,
            plannedQuantity: true,
          },
          orderBy: { sequence: "asc" },
        },
      },
      orderBy: { resolvedDueDate: "asc" },
      take: 200,
    }),
    prisma.organization.findFirst({
      where: { id: context.organizationId },
      select: { name: true },
    }),
  ]);

  const evaluations = await evaluateOrganizationOrders({
    organizationId: context.organizationId,
    orders,
    asOfDate: asOf,
  });

  const allRows = orders.map((order) => ({ order, evaluation: evaluations.get(order.id)! }));

  const kpiCounts = allRows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (matchesStatusGroup(row.evaluation.displayStatus, "delayed")) acc.delayed += 1;
      else if (matchesStatusGroup(row.evaluation.displayStatus, "getting_delayed")) acc.gettingDelayed += 1;
      else if (matchesStatusGroup(row.evaluation.displayStatus, "on_time")) acc.onTime += 1;
      else if (matchesStatusGroup(row.evaluation.displayStatus, "not_started")) acc.notStarted += 1;
      else if (matchesStatusGroup(row.evaluation.displayStatus, "completed")) acc.completed += 1;
      return acc;
    },
    { total: 0, onTime: 0, gettingDelayed: 0, delayed: 0, notStarted: 0, completed: 0 },
  );

  const live = allRows
    .filter((row) => matchesStatusGroup(row.evaluation.displayStatus, statusGroup))
    .sort((a, b) => {
      const severity = STATUS_SEVERITY[a.evaluation.displayStatus] - STATUS_SEVERITY[b.evaluation.displayStatus];
      if (severity !== 0) return severity;
      return a.order.resolvedDueDate.getTime() - b.order.resolvedDueDate.getTime();
    });

  const liveRows: LiveOrderRow[] = live.map(({ order, evaluation }) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    clientName: order.client.name,
    productName: order.product.name,
    plantName: order.plant.name,
    quantity: order.quantity,
    completedQuantity: evaluation.completedQuantity,
    remainingQuantity: evaluation.remainingQuantity,
    progressPercent: evaluation.progressPercent,
    currentStageName: evaluation.currentStageName,
    dueDate: formatDateOnly(order.resolvedDueDate),
    daysToDue: daysToDue(order.resolvedDueDate, asOf),
    expectedCompletion: evaluation.estimatedCompletionDate
      ? formatDateOnly(evaluation.estimatedCompletionDate)
      : null,
    status: evaluation.displayStatus,
    stages: orderStageProgress(evaluation.stages, order.quantity),
  }));

  const stageRollup = aggregateStageProgress(
    allRows.map(({ order, evaluation }) => ({
      orderQuantity: order.quantity,
      stages: evaluation.stages,
    })),
  );

  const pendingByClient = new Map<
    string,
    { clientName: string; count: number; delayed: number; gettingDelayed: number; onTime: number; qty: number }
  >();
  for (const row of allRows) {
    if (row.evaluation.derivedLifecycle === "COMPLETED" || row.order.lifecycleStatus === "CANCELLED") {
      continue;
    }
    const current = pendingByClient.get(row.order.clientId) ?? {
      clientName: row.order.client.name,
      count: 0,
      delayed: 0,
      gettingDelayed: 0,
      onTime: 0,
      qty: 0,
    };
    current.count += 1;
    current.qty += row.evaluation.remainingQuantity;
    if (matchesStatusGroup(row.evaluation.displayStatus, "delayed")) current.delayed += 1;
    else if (matchesStatusGroup(row.evaluation.displayStatus, "getting_delayed")) current.gettingDelayed += 1;
    else if (matchesStatusGroup(row.evaluation.displayStatus, "on_time") || row.evaluation.displayStatus === "NOT_STARTED") {
      current.onTime += 1;
    }
    pendingByClient.set(row.order.clientId, current);
  }
  const pendingByClientSorted = [...pendingByClient.values()].sort(
    (a, b) => b.delayed - a.delayed || b.gettingDelayed - a.gettingDelayed || b.qty - a.qty,
  );

  const chartScope = {
    organizationId: context.organizationId,
    from,
    to,
    plantIds,
    clientId,
    productId,
    orderId,
    processId,
  };

  const [clientProductRows, processRows, weeklyStageRows] = await Promise.all([
    productionByClientProduct(chartScope),
    productionByProcess(chartScope),
    productionByClientOrderProcess(chartScope),
  ]);

  const productKeys = [...new Set(clientProductRows.map((row) => row.productName))].sort();
  const clientProductChartMap = new Map<string, Record<string, string | number>>();
  for (const row of clientProductRows) {
    const label = row.clientName;
    const current = clientProductChartMap.get(row.clientId) ?? { client: label };
    current[row.productName] = Number(current[row.productName] ?? 0) + row.quantity;
    clientProductChartMap.set(row.clientId, current);
  }
  const clientProductChart = [...clientProductChartMap.values()].sort((a, b) => {
    const sum = (row: Record<string, string | number>) =>
      productKeys.reduce((total, key) => total + Number(row[key] ?? 0), 0);
    return sum(b) - sum(a);
  });

  const processChart = processRows.map((row) => ({
    processName: row.processName,
    quantity: row.quantity,
  }));

  const weeklyGroupsMap = new Map<string, WeeklyOrderStageRow>();
  for (const row of weeklyStageRows) {
    let client = weeklyGroupsMap.get(row.clientId);
    if (!client) {
      client = { clientId: row.clientId, clientName: row.clientName, orders: [] };
      weeklyGroupsMap.set(row.clientId, client);
    }
    let order = client.orders.find((item) => item.orderId === row.orderId);
    if (!order) {
      order = {
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        productName: row.productName,
        stages: [],
      };
      client.orders.push(order);
    }
    order.stages.push({
      processCode: row.processCode,
      processName: row.processName,
      quantity: row.quantity,
    });
  }
  const weeklyGroups = [...weeklyGroupsMap.values()];

  function kpiHref(group: StatusGroup) {
    const next = statusGroup === group ? null : group === "total" ? null : group;
    return `/dashboard${buildDashboardQuery(currentQuery, { statusGroup: next })}`;
  }

  const visiblePlants = plants.filter((plant) => !scopedPlantIds || scopedPlantIds.includes(plant.id));
  const selectClass =
    "rounded-md border border-line-strong bg-input px-2.5 py-2 text-[12.5px] text-ink outline-none focus:ring-2 focus:ring-ring";

  return (
    <main className="mx-auto max-w-6xl space-y-5 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-medium text-ink-soft">{organization?.name ?? "Organization"}</p>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">Production Control Dashboard</h1>
        </div>
        <p className="font-mono text-[11.5px] text-ink-soft">{formatDateOnly(asOf)}</p>
      </div>

      <section className="flex flex-wrap gap-2.5">
        <KpiCard
          label="Delayed"
          value={kpiCounts.delayed}
          sub="need action now"
          tone="delayed"
          icon={<AlertTriangle size={15} />}
          href={kpiHref("delayed")}
          active={statusGroup === "delayed"}
          viewAllHref={`/orders`}
        />
        <KpiCard
          label="Getting Delayed"
          value={kpiCounts.gettingDelayed}
          sub="approaching risk"
          tone="warn"
          icon={<Clock size={15} />}
          href={kpiHref("getting_delayed")}
          active={statusGroup === "getting_delayed"}
          viewAllHref={`/orders`}
        />
        <KpiCard
          label="On Time"
          value={kpiCounts.onTime}
          sub="on track"
          tone="good"
          icon={<CheckCircle2 size={15} />}
          href={kpiHref("on_time")}
          active={statusGroup === "on_time"}
          viewAllHref={`/orders`}
        />
        <KpiCard
          label="Not Yet Started"
          value={kpiCounts.notStarted}
          sub="no process begun"
          tone="neutral"
          icon={<Factory size={15} />}
          href={kpiHref("not_started")}
          active={statusGroup === "not_started"}
          viewAllHref={`/orders`}
        />
        <KpiCard
          label="Completed"
          value={kpiCounts.completed}
          sub="fully processed"
          tone="neutral"
          icon={<CheckCircle2 size={15} />}
          href={kpiHref("completed")}
          active={statusGroup === "completed"}
          viewAllHref={`/orders`}
        />
        <KpiCard
          label="Total Orders"
          value={kpiCounts.total}
          sub="in current filter"
          tone="accent"
          icon={<TrendingUp size={15} />}
          href={kpiHref("total")}
          active={!statusGroup || statusGroup === "total"}
          viewAllHref={`/orders`}
        />
      </section>

      <form className="grid gap-3 rounded border border-line bg-panel p-4 sm:grid-cols-4" method="get">
        {statusGroup ? <input type="hidden" name="statusGroup" value={statusGroup} /> : null}
        <select name="plantId" defaultValue={requestedPlant ?? ""} className={selectClass}>
          <option value="">All permitted plants</option>
          {visiblePlants.map((plant) => (
            <option key={plant.id} value={plant.id}>
              {plant.name}
            </option>
          ))}
        </select>
        <select name="clientId" defaultValue={clientId ?? ""} className={selectClass}>
          <option value="">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <select name="productId" defaultValue={productId ?? ""} className={selectClass}>
          <option value="">All products</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <select name="orderId" defaultValue={orderId ?? ""} className={selectClass}>
          <option value="">All orders</option>
          {orders.map((order) => (
            <option key={order.id} value={order.id}>
              {order.orderNumber}
            </option>
          ))}
        </select>
        <select name="processId" defaultValue={processId ?? ""} className={selectClass}>
          <option value="">All processes</option>
          {processes.map((process) => (
            <option key={process.id} value={process.id}>
              {process.name}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={formatDateOnly(from)} className={selectClass} />
        <input type="date" name="to" defaultValue={formatDateOnly(to)} className={selectClass} />
        <button type="submit" className="rounded-md bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-500">
          Apply filters
        </button>
      </form>

      <section className="space-y-3">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">Period output</h2>
          <p className="text-[11px] text-ink-soft">
            {formatDateOnly(from)} → {formatDateOnly(to)} — finished goods by client × product, and units completed per
            process
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[280px] flex-1 rounded border border-line bg-panel p-4">
            <h3 className="text-[12.5px] font-semibold text-ink">Client × product</h3>
            <p className="mb-2 text-[11px] text-ink-soft">Finished-goods units (last stage) in the date range</p>
            <ClientProductChart data={clientProductChart} productKeys={productKeys} />
          </div>
          <div className="min-w-[280px] flex-1 rounded border border-line bg-panel p-4">
            <h3 className="text-[12.5px] font-semibold text-ink">Process output</h3>
            <p className="mb-2 text-[11px] text-ink-soft">Units completed at each process in the date range</p>
            <ProcessOutputChart data={processChart} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold text-ink">Weekly — client orders by stage</h2>
          <p className="text-[11px] text-ink-soft">
            Entries in {formatDateOnly(from)} → {formatDateOnly(to)}: each order lists process quantities completed
            (e.g. Cutting:50, Framing:20)
          </p>
        </div>
        <WeeklyOrderStagePanel groups={weeklyGroups} />
      </section>

      <section className="rounded border border-line bg-panel p-4">
        <h2 className="text-[13px] font-semibold text-ink">Process pipeline — units by stage</h2>
        <p className="mb-2 text-[11px] text-ink-soft">
          Completed at stage = cumulative quantity recorded for that process. Waiting = finished previous stage but not
          this one. Aggregated across filtered orders by process code.
        </p>
        <StagePipelineChart
          data={stageRollup.map((row) => ({
            processName: row.processName,
            cumulative: row.cumulative,
            sitting: row.sitting,
          }))}
        />
      </section>

      <section className="overflow-hidden rounded border border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold text-ink">Pending Orders — Client Wise</h2>
          <p className="text-[11px] text-ink-soft">Clients with delayed orders surface first</p>
        </div>
        <div className="grid grid-cols-[1.6fr_90px_90px_90px_90px_110px] border-b border-line px-4 py-2 text-[10.5px] font-semibold text-ink-soft">
          <span>Client</span>
          <span>Orders</span>
          <span>Delayed</span>
          <span>At Risk</span>
          <span>On Time</span>
          <span>Pending Qty</span>
        </div>
        {pendingByClientSorted.length === 0 ? (
          <p className="p-4 text-sm text-ink-faint">No pending orders in the current filter.</p>
        ) : (
          pendingByClientSorted.map((row) => (
            <div
              key={row.clientName}
              className="grid grid-cols-[1.6fr_90px_90px_90px_90px_110px] items-center border-b border-line px-4 py-2.5 text-[13px]"
            >
              <span className="font-medium text-ink">{row.clientName}</span>
              <span className="font-mono">{row.count}</span>
              <span className={`font-mono ${row.delayed > 0 ? "font-bold text-delayed" : "text-ink-faint"}`}>
                {row.delayed}
              </span>
              <span className={`font-mono ${row.gettingDelayed > 0 ? "font-bold text-warn" : "text-ink-faint"}`}>
                {row.gettingDelayed}
              </span>
              <span className="font-mono text-on-time">{row.onTime}</span>
              <span className="font-mono text-ink-soft">{row.qty}</span>
            </div>
          ))
        )}
      </section>

      <section className="overflow-hidden rounded border border-line bg-panel">
        <div className="border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">Live Order Tracking</h2>
              <p className="text-[11px] text-ink-soft">
                Delayed and at-risk first — expand a row for process completion bars. Status from the production engine.
              </p>
            </div>
            {statusGroup ? (
              <Link
                href={`/dashboard${buildDashboardQuery(currentQuery, { statusGroup: null })}`}
                className="text-[11px] font-medium text-accent hover:underline"
              >
                Clear status filter
              </Link>
            ) : null}
          </div>
        </div>
        <LiveTrackingTable rows={liveRows} />
        <p className="border-t border-line px-4 py-2 text-[11px] text-ink-faint">
          Showing {liveRows.length} of up to 200 orders. Overall % = last-stage cumulative ÷ order quantity.
        </p>
      </section>
    </main>
  );
}
