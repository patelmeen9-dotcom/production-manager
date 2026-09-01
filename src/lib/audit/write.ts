import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function writeAuditLog(input: {
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        previousValue:
          input.previousValue === undefined ? undefined : (input.previousValue as Prisma.InputJsonValue),
        newValue: input.newValue === undefined ? undefined : (input.newValue as Prisma.InputJsonValue),
        reason: input.reason,
      },
    });
  } catch (error) {
    logger.error("audit_write_failed", { message: error instanceof Error ? error.message : "unknown" });
  }
}
