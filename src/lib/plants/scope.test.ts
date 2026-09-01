import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { ALL_PLANTS, assertPlantAccess, canManageMasters, canRecordProduction, resolvePlantScope } from "@/lib/plants/scope";

const orgPlants = ["mumbai", "pune", "ahmedabad"];

describe("plant access", () => {
  it("lets organization admins use All Plants", () => {
    const scope = resolvePlantScope({
      role: Role.ORGANIZATION_ADMIN,
      requestedPlantId: ALL_PLANTS,
      grantedPlantIds: [],
      organizationPlantIds: orgPlants,
    });
    expect(scope).toEqual({ mode: "all" });
  });

  it("lets an admin pin a single plant that belongs to the organization", () => {
    const scope = resolvePlantScope({
      role: Role.ORGANIZATION_ADMIN,
      requestedPlantId: "pune",
      grantedPlantIds: [],
      organizationPlantIds: orgPlants,
    });
    expect(scope).toEqual({ mode: "one", plantId: "pune" });
  });

  it("ignores a plant id that is not in the organization", () => {
    const scope = resolvePlantScope({
      role: Role.ORGANIZATION_ADMIN,
      requestedPlantId: "other-org-plant",
      grantedPlantIds: [],
      organizationPlantIds: orgPlants,
    });
    expect(scope).toEqual({ mode: "all" });
  });

  it("restricts operators to granted plants", () => {
    const scope = resolvePlantScope({
      role: Role.PRODUCTION_OPERATOR,
      requestedPlantId: "pune",
      grantedPlantIds: ["mumbai"],
      organizationPlantIds: orgPlants,
    });
    expect(scope).toEqual({ mode: "one", plantId: "mumbai" });
  });

  it("rejects an unauthorized plant on mutation", () => {
    const scope = resolvePlantScope({
      role: Role.PRODUCTION_OPERATOR,
      requestedPlantId: "mumbai",
      grantedPlantIds: ["mumbai"],
      organizationPlantIds: orgPlants,
    });
    expect(() => assertPlantAccess(scope, "pune")).toThrow(AppError);
    expect(() => assertPlantAccess(scope, "mumbai")).not.toThrow();
  });

  it("does not grant access when the user has no plant grants", () => {
    const scope = resolvePlantScope({
      role: Role.VIEWER,
      requestedPlantId: "mumbai",
      grantedPlantIds: [],
      organizationPlantIds: orgPlants,
    });
    expect(scope).toEqual({ mode: "none" });
    expect(() => assertPlantAccess(scope, "mumbai")).toThrow(AppError);
  });
});

describe("master data roles", () => {
  it("lets production managers maintain masters", () => {
    expect(canManageMasters(Role.PRODUCTION_MANAGER)).toBe(true);
    expect(canManageMasters(Role.PRODUCTION_OPERATOR)).toBe(false);
    expect(canManageMasters(Role.VIEWER)).toBe(false);
    expect(canRecordProduction(Role.PRODUCTION_OPERATOR)).toBe(true);
    expect(canRecordProduction(Role.VIEWER)).toBe(false);
  });
});
