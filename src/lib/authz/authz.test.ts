import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertOrganizationAccess,
  assertRole,
  organizationIdFromIdentity,
  requireOrganizationId,
  tenantWhere,
} from "@/lib/authz";
import { AppError } from "@/lib/errors";
import type { AuthContext } from "@/lib/authz";

function ctx(overrides: Partial<AuthContext>): AuthContext {
  return {
    userId: "user-a",
    organizationId: "org-a",
    role: Role.PRODUCTION_MANAGER,
    isActive: true,
    ...overrides,
  };
}

describe("organization isolation", () => {
  it("uses the authenticated user's organization, not a client-supplied id", () => {
    const clientSuppliedOrg = "org-b";
    const identity = ctx({ organizationId: "org-a" });
    expect(organizationIdFromIdentity(identity)).toBe("org-a");
    expect(organizationIdFromIdentity(identity)).not.toBe(clientSuppliedOrg);
  });

  it("allows access only to records in the user's organization", () => {
    expect(() => assertOrganizationAccess(ctx({ organizationId: "org-a" }), "org-a")).not.toThrow();
    expect(() => assertOrganizationAccess(ctx({ organizationId: "org-a" }), "org-b")).toThrow(AppError);
  });

  it("does not let a tenant user adopt another organization via input", () => {
    const user = ctx({ organizationId: "org-a", role: Role.ORGANIZATION_ADMIN });
    const attemptedOrgId = "org-b";
    expect(() => assertOrganizationAccess(user, attemptedOrgId)).toThrow(/another organization/);
    expect(tenantWhere(user)).toEqual({ organizationId: "org-a" });
  });

  it("requires an organization for tenant roles", () => {
    expect(() => requireOrganizationId(ctx({ organizationId: null, role: Role.VIEWER }))).toThrow(AppError);
  });

  it("allows SUPER_ADMIN to access any tenant record", () => {
    const superAdmin = ctx({ organizationId: null, role: Role.SUPER_ADMIN });
    expect(() => assertOrganizationAccess(superAdmin, "org-b")).not.toThrow();
  });
});

describe("role checks", () => {
  it("rejects operators from admin-only actions", () => {
    expect(() =>
      assertRole(ctx({ role: Role.PRODUCTION_OPERATOR }), [Role.ORGANIZATION_ADMIN]),
    ).toThrow(AppError);
  });

  it("allows listed roles", () => {
    expect(() =>
      assertRole(ctx({ role: Role.ORGANIZATION_ADMIN }), [Role.ORGANIZATION_ADMIN, Role.PRODUCTION_MANAGER]),
    ).not.toThrow();
  });
});
