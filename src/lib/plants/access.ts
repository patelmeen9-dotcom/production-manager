import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireOrganizationId, type AuthContext } from "@/lib/authz";
import { getRequestedPlantId } from "@/lib/plants/cookie";
import { canUseAllPlantsView, resolvePlantScope, type PlantScope } from "@/lib/plants/scope";

export async function loadPlantScope(context: AuthContext): Promise<{
  scope: PlantScope;
  plants: { id: string; code: string; name: string; location: string | null; isActive: boolean }[];
}> {
  const organizationId = requireOrganizationId(context);

  const plants = await prisma.plant.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, location: true, isActive: true },
  });

  const granted = canUseAllPlantsView(context.role)
    ? plants.map((plant) => plant.id)
    : (
        await prisma.userPlantAccess.findMany({
          where: { organizationId, userId: context.userId },
          select: { plantId: true },
        })
      ).map((row) => row.plantId);

  const requestedPlantId = await getRequestedPlantId();
  const scope = resolvePlantScope({
    role: context.role,
    requestedPlantId,
    grantedPlantIds: granted,
    organizationPlantIds: plants.map((plant) => plant.id),
  });

  return { scope, plants };
}

export async function requireGrantedPlant(context: AuthContext, plantId: string) {
  const organizationId = requireOrganizationId(context);
  const plant = await prisma.plant.findFirst({
    where: { id: plantId, organizationId },
  });
  if (!plant) {
    throw new AppError("NOT_FOUND", "Plant not found.", 404);
  }
  if (canUseAllPlantsView(context.role)) {
    return plant;
  }
  const grant = await prisma.userPlantAccess.findUnique({
    where: { userId_plantId: { userId: context.userId, plantId } },
  });
  if (!grant) {
    throw new AppError("FORBIDDEN", "You do not have access to this plant.", 403);
  }
  return plant;
}

export async function requirePlantForMutation(context: AuthContext, plantId: string) {
  return requireGrantedPlant(context, plantId);
}
