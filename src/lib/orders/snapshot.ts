import { AppError } from "@/lib/errors";

export type MappingRow = {
  processId: string;
  sequence: number;
  process: { name: string; code: string };
};

export function buildOrderProcessSnapshot(mapping: MappingRow[], quantity: number) {
  if (quantity <= 0) {
    throw new AppError("VALIDATION", "Quantity must be greater than zero.", 400);
  }
  const active = [...mapping].sort((a, b) => a.sequence - b.sequence);
  if (active.length === 0) {
    throw new AppError("VALIDATION", "No process mapping exists for this plant and product.", 400);
  }
  return active.map((row) => ({
    processId: row.processId,
    processName: row.process.name,
    processCode: row.process.code,
    sequence: row.sequence,
    plannedQuantity: quantity,
  }));
}
