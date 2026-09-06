import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadPlantScope } from "@/lib/plants/access";
import { canManageMasters, canManagePlants, canUseAllPlantsView } from "@/lib/plants/scope";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await getAuthContext();
  if (!context) {
    redirect("/login");
  }

  const [organization, plantState] = context.organizationId
    ? await Promise.all([
        prisma.organization.findUnique({
          where: { id: context.organizationId },
          select: { name: true },
        }),
        loadPlantScope(context),
      ])
    : [null, { scope: { mode: "none" as const }, plants: [] as { id: string; name: string; isActive: boolean }[], grantedPlantIds: [] as string[] }];

  const granted = new Set(plantState.grantedPlantIds ?? []);
  const visiblePlants = plantState.plants.filter((plant) => granted.has(plant.id));

  return (
    <div className="min-h-screen">
      <AppHeader
        organizationName={organization?.name ?? null}
        role={context.role}
        plants={visiblePlants.map((plant) => ({ id: plant.id, name: plant.name }))}
        scope={plantState.scope}
        canUseAllPlants={canUseAllPlantsView(context.role)}
        canManageOrg={canManagePlants(context.role)}
        canSeeAudit={canManageMasters(context.role)}
      />
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}
