import type { Metadata } from "next";
import Link from "next/link";
import { Role } from "@prisma/client";
import { requireTenantContext } from "@/lib/auth/session";
import { canManagePlants } from "@/lib/plants/scope";
import { loadPlantScope } from "@/lib/plants/access";
import { SavedBanner } from "@/components/ui/saved-banner";

export const metadata: Metadata = { title: "Plants" };

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const params = await searchParams;
  const { plants, grantedPlantIds } = await loadPlantScope(context);
  const manage = canManagePlants(context.role);
  const granted = new Set(grantedPlantIds);
  const visible = plants.filter((plant) => granted.has(plant.id));

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Plants</h1>
        {manage ? (
          <Link className="text-sm text-sky-400 hover:text-sky-300" href="/plants/new">
            New plant
          </Link>
        ) : null}
      </div>
      <SavedBanner message={params.saved} />
      <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
        {visible.length === 0 ? (
          <li className="p-4 text-sm text-slate-400">No plants available for this user.</li>
        ) : (
          visible.map((plant) => (
            <li key={plant.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-white">{plant.name}</p>
                <p className="text-sm text-slate-400">
                  {plant.code} · {plant.location || "No location"} · {plant.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              {manage ? (
                <Link className="text-sm text-sky-400" href={`/plants/${plant.id}/edit`}>
                  Edit
                </Link>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {context.role === Role.PRODUCTION_OPERATOR || context.role === Role.VIEWER ? (
        <p className="text-xs text-slate-500">Plant access is assigned by an organization admin.</p>
      ) : null}
    </main>
  );
}
