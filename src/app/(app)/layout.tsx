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

  const organization = context.organizationId
    ? await prisma.organization.findUnique({
        where: { id: context.organizationId },
        select: { name: true },
      })
    : null;

  const plantState = context.organizationId
    ? await loadPlantScope(context)
    : { scope: { mode: "none" as const }, plants: [] };

  const grantedIds = canUseAllPlantsView(context.role)
    ? new Set(plantState.plants.map((plant) => plant.id))
    : new Set(
        (
          await prisma.userPlantAccess.findMany({
            where: { userId: context.userId, organizationId: context.organizationId ?? undefined },
            select: { plantId: true },
          })
        ).map((row) => row.plantId),
      );

  const visiblePlants = plantState.plants.filter((plant) => grantedIds.has(plant.id));

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
