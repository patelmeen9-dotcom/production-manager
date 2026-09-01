import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";
import { canManageMasters, plantIdsForQuery } from "@/lib/plants/scope";
import { formatDateOnly } from "@/lib/orders/date-rules";
import { toPageParams } from "@/lib/pagination";
import { Pager } from "@/components/ui/pager";
import { SavedBanner } from "@/components/ui/saved-banner";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const params = await searchParams;
  const manage = canManageMasters(context.role);
  const { scope } = await loadPlantScope(context);
  const plantFilter = plantIdsForQuery(scope);
  const { page, pageSize, skip } = toPageParams({ page: params.page });

  if (plantFilter && plantFilter.length === 0) {
    return (
      <main className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold text-white">Production orders</h1>
        <p className="text-sm text-slate-400">No plant access is assigned to this user.</p>
      </main>
    );
  }

  const where = {
    organizationId: context.organizationId,
    ...(plantFilter ? { plantId: { in: plantFilter } } : {}),
  };

  const [totalCount, orders] = await Promise.all([
    prisma.productionOrder.count({ where }),
    prisma.productionOrder.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        quantity: true,
        resolvedDueDate: true,
        client: { select: { name: true } },
        product: { select: { name: true } },
        plant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Production orders</h1>
        {manage ? (
          <Link className="text-sm text-sky-400" href="/orders/new">
            New order
          </Link>
        ) : null}
      </div>
      <SavedBanner message={params.saved} />
      <p className="text-xs text-slate-500">Paged from PostgreSQL. Full history stays in the database.</p>
      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {orders.length === 0 ? (
          <li className="p-4 text-sm text-slate-400">No orders in the current plant scope.</li>
        ) : (
          orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-white">{order.orderNumber}</p>
                <p className="text-sm text-slate-400">
                  {order.client.name} · {order.product.name} · {order.plant.name} · qty {order.quantity} · due{" "}
                  {formatDateOnly(order.resolvedDueDate)}
                </p>
              </div>
              <Link className="text-sm text-sky-400" href={`/orders/${order.id}`}>
                View
              </Link>
            </li>
          ))
        )}
      </ul>
      <Pager basePath="/orders" page={page} pageSize={pageSize} totalCount={totalCount} />
    </main>
  );
}

