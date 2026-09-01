import { Role } from "@prisma/client";
import { AppError } from "@/lib/errors";

export type AuthContext = {
  userId: string;
  organizationId: string | null;
  role: Role;
  isActive: boolean;
};

const TENANT_ROLES: readonly Role[] = [
  Role.ORGANIZATION_ADMIN,
  Role.PRODUCTION_MANAGER,
  Role.PRODUCTION_OPERATOR,
  Role.VIEWER,
];

export function isTenantRole(role: Role): boolean {
  return TENANT_ROLES.includes(role);
}

/**
 * Organization context is always taken from the authenticated user record.
 * Client-supplied organization IDs are ignored.
 */
export function organizationIdFromIdentity(context: Pick<AuthContext, "organizationId" | "role">): string | null {
  if (context.role === Role.SUPER_ADMIN) {
    return context.organizationId;
  }
  return context.organizationId;
}

export function requireOrganizationId(context: Pick<AuthContext, "organizationId" | "role">): string {
  const organizationId = organizationIdFromIdentity(context);
  if (!organizationId) {
    throw new AppError("FORBIDDEN", "An organization context is required for this action.", 403);
  }
  return organizationId;
}

export function assertAuthenticated(context: AuthContext | null): asserts context is AuthContext {
  if (!context) {
    throw new AppError("UNAUTHORIZED", "You must be signed in.", 401);
  }
  if (!context.isActive) {
    throw new AppError("FORBIDDEN", "This account is inactive.", 403);
  }
}

export function assertRole(context: AuthContext, allowed: readonly Role[]): void {
  if (!allowed.includes(context.role)) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action.", 403);
  }
}

/**
 * Tenant isolation: a user may only access records whose organizationId matches
 * the organization on their user record. SUPER_ADMIN may access any tenant.
 * Never use a browser-supplied organizationId as the comparison source.
 */
export function assertOrganizationAccess(context: AuthContext, recordOrganizationId: string): void {
  if (context.role === Role.SUPER_ADMIN) {
    return;
  }

  const userOrganizationId = requireOrganizationId(context);
  if (userOrganizationId !== recordOrganizationId) {
    throw new AppError("FORBIDDEN", "This record belongs to another organization.", 403);
  }
}

export function tenantWhere(context: AuthContext): { organizationId: string } {
  return { organizationId: requireOrganizationId(context) };
}
