import { Role } from "@prisma/client";
import { AppError } from "@/lib/errors";

export const ALL_PLANTS = "__all__";

export type PlantScope =
  | { mode: "all" }
  | { mode: "one"; plantId: string }
  | { mode: "none" };

export function canUseAllPlantsView(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.ORGANIZATION_ADMIN;
}

export function canManagePlants(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.ORGANIZATION_ADMIN;
}

export function canManageMasters(role: Role): boolean {
  return (
    role === Role.SUPER_ADMIN || role === Role.ORGANIZATION_ADMIN || role === Role.PRODUCTION_MANAGER
  );
}

export function canRecordProduction(role: Role): boolean {
  return (
    role === Role.SUPER_ADMIN ||
    role === Role.ORGANIZATION_ADMIN ||
    role === Role.PRODUCTION_MANAGER ||
    role === Role.PRODUCTION_OPERATOR
  );
}

export function canManageUserPlantAccess(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.ORGANIZATION_ADMIN;
}

/**
 * Resolves the active plant from a requested id (cookie/UI) against grants loaded from the database.
 * The requested id is never trusted on its own.
 */
export function resolvePlantScope(input: {
  role: Role;
  requestedPlantId: string | null;
  grantedPlantIds: string[];
  organizationPlantIds: string[];
}): PlantScope {
  const orgSet = new Set(input.organizationPlantIds);

  if (canUseAllPlantsView(input.role)) {
    if (!input.requestedPlantId || input.requestedPlantId === ALL_PLANTS) {
      return { mode: "all" };
    }
    if (orgSet.has(input.requestedPlantId)) {
      return { mode: "one", plantId: input.requestedPlantId };
    }
    return { mode: "all" };
  }

  const granted = input.grantedPlantIds.filter((id) => orgSet.has(id));
  if (granted.length === 0) {
    return { mode: "none" };
  }

  if (input.requestedPlantId && granted.includes(input.requestedPlantId)) {
    return { mode: "one", plantId: input.requestedPlantId };
  }

  return { mode: "one", plantId: granted[0] };
}

export function assertPlantAccess(scope: PlantScope, plantId: string): void {
  if (scope.mode === "all") {
    return;
  }
  if (scope.mode === "one" && scope.plantId === plantId) {
    return;
  }
  throw new AppError("FORBIDDEN", "You do not have access to this plant.", 403);
}

export function plantIdsForQuery(scope: PlantScope): string[] | null {
  if (scope.mode === "all") {
    return null;
  }
  if (scope.mode === "one") {
    return [scope.plantId];
  }
  return [];
}
