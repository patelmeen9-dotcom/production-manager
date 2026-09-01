import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";
import { canRecordProduction, plantIdsForQuery } from "@/lib/plants/scope";
import { formatDateOnly, parseDateOnly } from "@/lib/orders/date-rules";
import { toPageParams } from "@/lib/pagination";
import { Pager } from "@/components/ui/pager";
import { SavedBanner } from "@/components/ui/saved-banner";

export const metadata: Metadata = { title: "Production entries" };

export default async function EntriesPage({
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
  const { scope } = await loadPlantScope(context);
  const plantFilter = plantIdsForQuery(scope);
  const { page, pageSize, skip } = toPageParams({ page: params.page });
  const from = get("from") ? parseDateOnly(get("from")!) : undefined;
  const to = get("to") ? parseDateOnly(get("to")!) : undefined;

  if (plantFilter && plantFilter.length === 0) {
    return <p className="text-sm text-slate-400">No plant access.</p>;
  }

  const where = {
    organizationId: context.organizationId,
    ...(plantFilter ? { plantId: { in: plantFilter } } : {}),
    ...(from || to
      ? {
          entryDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const [totalCount, entries] = await Promise.all([
    prisma.productionEntry.count({ where }),
    prisma.productionEntry.findMany({
      where,
      select: {
        id: true,
        entryDate: true,
        quantity: true,
        productionOrder: { select: { orderNumber: true } },
        orderProcess: { select: { processName: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
  ]);

  const currentQuery = {
    from: get("from"),
    to: get("to"),
  };

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Production entries</h1>
        {canRecordProduction(context.role) ? (
          <Link className="text-sm text-sky-400" href="/entries/new">
            New entry
          </Link>
        ) : null}
      </div>
      <SavedBanner message={get("saved")} />
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 p-3" method="get">
        <label className="text-xs text-slate-400">
          From
          <input
            type="date"
            name="from"
            defaultValue={get("from") ?? ""}
            className="mt-1 block rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          To
          <input
            type="date"
            name="to"
            defaultValue={get("to") ?? ""}
            className="mt-1 block rounded-md border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-white"
          />
        </label>
        <button type="submit" className="rounded-md bg-sky-600 px-3 py-2 text-sm text-white">
          Filter
        </button>
      </form>
      <p className="text-xs text-slate-500">
        Date-scoped and paged. Multi-year history is aggregated or filtered in PostgreSQL, never loaded in full.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400">
          <tr>
            <th className="p-2">Date</th>
            <th className="p-2">Order</th>
            <th className="p-2">Stage</th>
            <th className="p-2">Qty</th>
            <th className="p-2">User</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t border-slate-800 text-slate-200">
              <td className="p-2">{formatDateOnly(entry.entryDate)}</td>
              <td className="p-2">{entry.productionOrder.orderNumber}</td>
              <td className="p-2">{entry.orderProcess.processName}</td>
              <td className="p-2">{entry.quantity}</td>
              <td className="p-2">{entry.createdBy.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager
        basePath="/entries"
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        currentQuery={currentQuery}
      />
    </main>
  );
}
