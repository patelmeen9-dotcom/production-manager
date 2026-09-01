import { Role } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { requireRoles } from "@/lib/auth/session";
import { canRecordProduction } from "@/lib/plants/scope";
import type { AuthContext } from "@/lib/authz";

const PRODUCTION_ROLES = [
  Role.SUPER_ADMIN,
  Role.ORGANIZATION_ADMIN,
  Role.PRODUCTION_MANAGER,
  Role.PRODUCTION_OPERATOR,
] as const;

export async function requireProductionRecorder(): Promise<AuthContext & { organizationId: string }> {
  const context = await requireRoles(PRODUCTION_ROLES);
  if (!canRecordProduction(context.role)) {
    throw new AppError("FORBIDDEN", "You cannot record production.", 403);
  }
  if (!context.organizationId) {
    throw new AppError("FORBIDDEN", "An organization context is required.", 403);
  }
  return { ...context, organizationId: context.organizationId };
}
