import { cache } from "react";
import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  type AuthContext,
  assertAuthenticated,
  assertOrganizationAccess,
  assertRole,
  requireOrganizationId,
} from "@/lib/authz";

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return null;
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    role: user.role,
    isActive: true,
  };
});

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();
  assertAuthenticated(context);
  return context;
}

export async function requireTenantContext(): Promise<AuthContext & { organizationId: string }> {
  const context = await requireAuthContext();
  const organizationId = requireOrganizationId(context);
  return { ...context, organizationId };
}

export async function requireRoles(allowed: readonly Role[]): Promise<AuthContext> {
  const context = await requireAuthContext();
  assertRole(context, allowed);
  return context;
}

export async function requireRecordOrganization(recordOrganizationId: string): Promise<AuthContext> {
  const context = await requireAuthContext();
  assertOrganizationAccess(context, recordOrganizationId);
  return context;
}

export async function getCurrentOrganization() {
  const context = await requireTenantContext();
  const organization = await prisma.organization.findFirst({
    where: { id: context.organizationId, isActive: true },
  });

  if (!organization) {
    throw new AppError("FORBIDDEN", "Organization is missing or inactive.", 403);
  }

  return { context, organization };
}
