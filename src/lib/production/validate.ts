import { AppError } from "@/lib/errors";

export type ProcessSnapshot = {
  id: string;
  sequence: number;
  processName: string;
  processCode: string;
  plannedQuantity: number;
  /** Planned days to complete this stage; null/undefined = use due-date/rate timing only. */
  expectedDays?: number | null;
  /** Planned units completable per day; used to derive stage duration when set. */
  unitsPerDay?: number | null;
};

export type IncrementalEntry = {
  orderProcessId: string;
  quantity: number;
};

export function assertValidProductionEntry(input: {
  quantity: number;
  lifecycleStatus: string;
  processes: ProcessSnapshot[];
  orderProcessId: string;
  existingEntries: IncrementalEntry[];
}): void {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new AppError("VALIDATION", "Quantity must be a positive integer. Entries are incremental, not cumulative.", 400);
  }
  if (input.lifecycleStatus === "CANCELLED") {
    throw new AppError("VALIDATION", "Production cannot be recorded on a cancelled order.", 400);
  }
  if (input.lifecycleStatus === "ON_HOLD") {
    throw new AppError("VALIDATION", "Production cannot be recorded while the order is on hold.", 400);
  }

  const processes = [...input.processes].sort((a, b) => a.sequence - b.sequence);
  const stage = processes.find((process) => process.id === input.orderProcessId);
  if (!stage) {
    throw new AppError("VALIDATION", "The selected stage is not part of this order's process snapshot.", 400);
  }

  const cumulative = new Map<string, number>();
  for (const process of processes) {
    cumulative.set(process.id, 0);
  }
  for (const entry of input.existingEntries) {
    cumulative.set(entry.orderProcessId, (cumulative.get(entry.orderProcessId) ?? 0) + entry.quantity);
  }

  const nextCumulative = (cumulative.get(stage.id) ?? 0) + input.quantity;
  if (nextCumulative > stage.plannedQuantity) {
    throw new AppError(
      "VALIDATION",
      `Quantity exceeds the planned amount for ${stage.processName} (${stage.plannedQuantity}).`,
      400,
    );
  }

  const index = processes.findIndex((process) => process.id === stage.id);
  if (index > 0) {
    const upstream = processes[index - 1];
    const upstreamCumulative = cumulative.get(upstream.id) ?? 0;
    if (nextCumulative > upstreamCumulative) {
      throw new AppError(
        "VALIDATION",
        `Downstream cumulative for ${stage.processName} cannot exceed ${upstream.processName} (${upstreamCumulative}).`,
        400,
      );
    }
  }
}
