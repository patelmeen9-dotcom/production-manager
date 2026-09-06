import { cache } from "react";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireOrganizationId, type AuthContext } from "@/lib/authz";
import { getRequestedPlantId } from "@/lib/plants/cookie";
import { canUseAllPlantsView, resolvePlantScope, type PlantScope } from "@/lib/plants/scope";

export type PlantListItem = {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
};

export type PlantScopeState = {
  scope: PlantScope;
  plants: PlantListItem[];
  grantedPlantIds: string[];
};

/**
 * Per-request memo of plant list + grants + resolved scope.
 * Cached on primitive args so layout and pages share one DB round-trip.
 */
const loadPlantScopeCached = cache(async (userId: string, organizationId: string, role: AuthContext["role"]): Promise<PlantScopeState> => {
  const canSeeAll = canUseAllPlantsView(role);
  const [plants, grantRows, requestedPlantId] = await Promise.all([
    prisma.plant.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, location: true, isActive: true },
    }),
    canSeeAll
      ? Promise.resolve([] as { plantId: string }[])
      : prisma.userPlantAccess.findMany({
          where: { organizationId, userId },
          select: { plantId: true },
        }),
    getRequestedPlantId(),
  ]);

  const grantedPlantIds = canSeeAll ? plants.map((plant) => plant.id) : grantRows.map((row) => row.plantId);
  const scope = resolvePlantScope({
    role,
    requestedPlantId,
    grantedPlantIds,
    organizationPlantIds: plants.map((plant) => plant.id),
  });

  return { scope, plants, grantedPlantIds };
});

export async function loadPlantScope(context: AuthContext): Promise<PlantScopeState> {
  const organizationId = requireOrganizationId(context);
  return loadPlantScopeCached(context.userId, organizationId, context.role);
}

export async function requireGrantedPlant(context: AuthContext, plantId: string) {
  const organizationId = requireOrganizationId(context);
  const [plant, grant] = await Promise.all([
    prisma.plant.findFirst({
      where: { id: plantId, organizationId },
    }),
    canUseAllPlantsView(context.role)
      ? Promise.resolve({ ok: true as const })
      : prisma.userPlantAccess.findUnique({
          where: { userId_plantId: { userId: context.userId, plantId } },
        }),
  ]);
  if (!plant) {
    throw new AppError("NOT_FOUND", "Plant not found.", 404);
  }
  if (!canUseAllPlantsView(context.role) && !grant) {
    throw new AppError("FORBIDDEN", "You do not have access to this plant.", 403);
  }
  return plant;
}

export async function requirePlantForMutation(context: AuthContext, plantId: string) {
  return requireGrantedPlant(context, plantId);
}
