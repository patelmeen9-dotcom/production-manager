import { Role } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { requireRoles } from "@/lib/auth/session";
import { canManageMasters } from "@/lib/plants/scope";
import type { AuthContext } from "@/lib/authz";

const MASTER_WRITE_ROLES = [Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN, Role.PRODUCTION_MANAGER] as const;

export async function requireMasterWriter(): Promise<AuthContext & { organizationId: string }> {
  const context = await requireRoles(MASTER_WRITE_ROLES);
  if (!canManageMasters(context.role)) {
    throw new AppError("FORBIDDEN", "You cannot manage master data.", 403);
  }
  if (!context.organizationId) {
    throw new AppError("FORBIDDEN", "An organization context is required.", 403);
  }
  return { ...context, organizationId: context.organizationId };
}
