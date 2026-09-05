import type { Metadata } from "next";
import Link from "next/link";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";
import { canManageMasters, plantIdsForQuery } from "@/lib/plants/scope";
import { SavedBanner } from "@/components/ui/saved-banner";

export const metadata: Metadata = { title: "Process mappings" };

export default async function MappingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const params = await searchParams;
  const manage = canManageMasters(context.role);
  const { scope } = await loadPlantScope(context);
  const plantFilter = plantIdsForQuery(scope);

  if (plantFilter && plantFilter.length === 0) {
    return (
      <main className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold text-white">Plant / product process mappings</h1>
        <p className="text-sm text-slate-400">No plant access is assigned to this user.</p>
      </main>
    );
  }

  const mappings = await prisma.plantProductProcessMapping.findMany({
    where: {
      organizationId: context.organizationId,
      ...(plantFilter ? { plantId: { in: plantFilter } } : {}),
    },
    include: { plant: true, product: true, process: true },
    orderBy: [{ plantId: "asc" }, { productId: "asc" }, { sequence: "asc" }],
  });

  const groups = new Map<string, typeof mappings>();
  for (const row of mappings) {
    const key = `${row.plantId}:${row.productId}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Plant / product process mappings</h1>
        {manage ? (
          <Link className="text-sm text-sky-400 hover:text-sky-300" href="/mappings/new">
            New mapping
          </Link>
        ) : null}
      </div>
      <SavedBanner message={params.saved} />
      <p className="text-sm text-slate-400">
        Mappings stay plant + product. Orders inherit this sequence and can add/remove/reorder stages per line at order
        time. Changing a mapping does not rewrite historical orders.
      </p>
      {groups.size === 0 ? (
        <p className="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">No mappings in the current plant scope.</p>
      ) : (
        <ul className="space-y-3">
          {[...groups.values()].map((rows) => {
            const first = rows[0];
            return (
              <li key={`${first.plantId}:${first.productId}`} className="rounded-lg border border-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-white">
                    {first.plant.name} · {first.product.name}
                  </p>
                  {manage ? (
                    <Link
                      className="text-sm text-sky-400"
                      href={`/mappings/${first.plantId}/${first.productId}/edit`}
                    >
                      Edit
                    </Link>
                  ) : null}
                </div>
                <ol className="mt-2 list-decimal pl-5 text-sm text-slate-300">
                  {rows.map((row) => (
                    <li key={row.id}>
                      {row.process.name} ({row.process.code})
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
