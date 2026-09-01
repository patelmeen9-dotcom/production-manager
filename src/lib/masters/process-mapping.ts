import { AppError } from "@/lib/errors";

export type MappingStep = {
  processId: string;
  sequence: number;
};

/**
 * Builds a 1-based sequence from ordered process ids.
 * Does not know or care about stage names.
 */
export function buildProcessMappingSteps(processIds: string[]): MappingStep[] {
  const cleaned = processIds.map((id) => id.trim()).filter((id) => id.length > 0);
  if (cleaned.length === 0) {
    throw new AppError("VALIDATION", "At least one process is required for a plant/product mapping.", 400);
  }

  const seen = new Set<string>();
  for (const processId of cleaned) {
    if (seen.has(processId)) {
      throw new AppError("VALIDATION", "A process cannot appear more than once in the same mapping.", 400);
    }
    seen.add(processId);
  }

  return cleaned.map((processId, index) => ({
    processId,
    sequence: index + 1,
  }));
}

export function assertProcessesBelongToOrganization(
  processIds: string[],
  organizationProcessIds: string[],
): void {
  const allowed = new Set(organizationProcessIds);
  for (const processId of processIds) {
    if (!allowed.has(processId)) {
      throw new AppError("FORBIDDEN", "A selected process does not belong to this organization.", 403);
    }
  }
}
