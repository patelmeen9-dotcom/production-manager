import type { OrganizationSettings } from "@/lib/organization-settings";
import { evaluateOrder, type OrderEvaluation, type StageState } from "@/lib/production/engine";
import type { IncrementalEntry, ProcessSnapshot } from "@/lib/production/validate";

export type OrderLineProcessSnapshot = ProcessSnapshot & {
  productionOrderLineId: string;
};

export type OrderLineForEvaluation = {
  id: string;
  quantity: number;
  label?: string;
  processes: ProcessSnapshot[];
};

/**
 * Evaluates an order that may have multiple product/category lines.
 * Each line has its own process snapshot; finished-goods progress is the sum of line completions.
 * Stage display merges by process code (sums planned/cumulative) for dashboard compatibility.
 */
export function evaluateOrderLines(input: {
  orderQuantity: number;
  effectiveStartDate: Date;
  resolvedDueDate: Date;
  lifecycleStatus: string;
  lines: OrderLineForEvaluation[];
  entries: IncrementalEntry[];
  firstEntryDate: Date | null;
  asOfDate: Date;
  settings: OrganizationSettings;
}): OrderEvaluation {
  if (input.lines.length === 0) {
    return evaluateOrder({
      orderQuantity: input.orderQuantity,
      effectiveStartDate: input.effectiveStartDate,
      resolvedDueDate: input.resolvedDueDate,
      lifecycleStatus: input.lifecycleStatus,
      processes: [],
      entries: input.entries,
      firstEntryDate: input.firstEntryDate,
      asOfDate: input.asOfDate,
      settings: input.settings,
    });
  }

  if (input.lines.length === 1) {
    const line = input.lines[0];
    const processIds = new Set(line.processes.map((process) => process.id));
    return evaluateOrder({
      orderQuantity: input.orderQuantity,
      effectiveStartDate: input.effectiveStartDate,
      resolvedDueDate: input.resolvedDueDate,
      lifecycleStatus: input.lifecycleStatus,
      processes: line.processes,
      entries: input.entries.filter((entry) => processIds.has(entry.orderProcessId)),
      firstEntryDate: input.firstEntryDate,
      asOfDate: input.asOfDate,
      settings: input.settings,
    });
  }

  const lineEvals = input.lines.map((line) => {
    const processIds = new Set(line.processes.map((process) => process.id));
    return {
      line,
      evaluation: evaluateOrder({
        orderQuantity: line.quantity,
        effectiveStartDate: input.effectiveStartDate,
        resolvedDueDate: input.resolvedDueDate,
        lifecycleStatus: input.lifecycleStatus,
        processes: line.processes,
        entries: input.entries.filter((entry) => processIds.has(entry.orderProcessId)),
        firstEntryDate: input.firstEntryDate,
        asOfDate: input.asOfDate,
        settings: input.settings,
      }),
    };
  });

  const completedQuantity = lineEvals.reduce((sum, row) => sum + row.evaluation.completedQuantity, 0);
  const remainingQuantity = Math.max(input.orderQuantity - completedQuantity, 0);
  const progressPercent =
    input.orderQuantity === 0 ? 0 : Math.min(100, (completedQuantity / input.orderQuantity) * 100);
  const productionStarted = lineEvals.some((row) => row.evaluation.productionStarted);
  const fullyComplete = lineEvals.every((row) => row.evaluation.derivedLifecycle === "COMPLETED");
  const derivedLifecycle: OrderEvaluation["derivedLifecycle"] = fullyComplete
    ? "COMPLETED"
    : productionStarted
      ? "IN_PRODUCTION"
      : "NOT_STARTED";

  const stages = mergeStagesByProcessCode(
    lineEvals.flatMap((row) =>
      row.evaluation.stages.map((stage) => ({
        ...stage,
        processName: row.line.label ? `${row.line.label} · ${stage.processName}` : stage.processName,
      })),
    ),
  );

  const incomplete = lineEvals.find((row) => row.evaluation.derivedLifecycle !== "COMPLETED");
  const currentStageName = fullyComplete
    ? (lineEvals[lineEvals.length - 1]?.evaluation.currentStageName ?? null)
    : (incomplete?.evaluation.currentStageName ?? null);

  // Re-run timing/start against aggregated quantities via a thin evaluateOrder on merged stages.
  const merged = evaluateOrder({
    orderQuantity: input.orderQuantity,
    effectiveStartDate: input.effectiveStartDate,
    resolvedDueDate: input.resolvedDueDate,
    lifecycleStatus: input.lifecycleStatus,
    processes: stages.map((stage) => ({
      id: stage.id,
      sequence: stage.sequence,
      processName: stage.processName,
      processCode: stage.processCode,
      plannedQuantity: stage.plannedQuantity,
    })),
    entries: stages.map((stage) => ({ orderProcessId: stage.id, quantity: stage.cumulative })),
    firstEntryDate: input.firstEntryDate,
    asOfDate: input.asOfDate,
    settings: input.settings,
  });

  // Prefer worst per-line timing so expected-days plans are not lost when merging stages by code.
  const timingRank = (status: OrderEvaluation["timingStatus"]) => {
    switch (status) {
      case "DELAYED":
        return 3;
      case "GETTING_DELAYED":
        return 2;
      case "ON_TIME":
        return 1;
      default:
        return 0;
    }
  };
  const worstTiming = lineEvals.reduce(
    (worst, row) => (timingRank(row.evaluation.timingStatus) > timingRank(worst) ? row.evaluation.timingStatus : worst),
    "NOT_APPLICABLE" as OrderEvaluation["timingStatus"],
  );
  const bestEstimate = lineEvals
    .map((row) => row.evaluation.estimatedCompletionDate)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())
    .at(-1) ?? null;

  return {
    ...merged,
    stages,
    currentStageName,
    currentStageComplete: fullyComplete,
    completedQuantity,
    remainingQuantity,
    progressPercent,
    productionStarted,
    derivedLifecycle,
    timingStatus: worstTiming === "NOT_APPLICABLE" ? merged.timingStatus : worstTiming,
    estimatedCompletionDate: bestEstimate ?? merged.estimatedCompletionDate,
    displayStatus:
      input.lifecycleStatus === "CANCELLED" || input.lifecycleStatus === "ON_HOLD"
        ? merged.displayStatus
        : fullyComplete
          ? "COMPLETED"
          : worstTiming === "DELAYED"
            ? "DELAYED"
            : worstTiming === "GETTING_DELAYED"
              ? "GETTING_DELAYED"
              : merged.displayStatus === "COMPLETED"
                ? "ON_TIME"
                : merged.displayStatus,
  };
}

function mergeStagesByProcessCode(stages: StageState[]): StageState[] {
  const map = new Map<string, StageState>();
  for (const stage of stages) {
    const existing = map.get(stage.processCode);
    if (!existing) {
      map.set(stage.processCode, {
        ...stage,
        id: `merged:${stage.processCode}`,
        processName: stage.processName.includes(" · ")
          ? stage.processName.split(" · ").slice(-1)[0]!
          : stage.processName,
      });
      continue;
    }
    existing.plannedQuantity += stage.plannedQuantity;
    existing.cumulative += stage.cumulative;
    existing.remaining = Math.max(existing.plannedQuantity - existing.cumulative, 0);
    existing.percentComplete =
      existing.plannedQuantity === 0
        ? 0
        : Math.min(100, (existing.cumulative / existing.plannedQuantity) * 100);
    existing.sequence = Math.min(existing.sequence, stage.sequence);
  }
  return [...map.values()].sort((a, b) => a.sequence - b.sequence || a.processName.localeCompare(b.processName));
}

/**
 * Restricts process snapshots and entries to the line that owns the selected stage.
 */
export function scopeProcessesToLine(
  processes: OrderLineProcessSnapshot[],
  orderProcessId: string,
  entries: IncrementalEntry[],
): { processes: ProcessSnapshot[]; entries: IncrementalEntry[] } {
  const target = processes.find((process) => process.id === orderProcessId);
  if (!target) {
    return { processes: [], entries: [] };
  }
  const lineProcesses = processes.filter((process) => process.productionOrderLineId === target.productionOrderLineId);
  const ids = new Set(lineProcesses.map((process) => process.id));
  return {
    processes: lineProcesses,
    entries: entries.filter((entry) => ids.has(entry.orderProcessId)),
  };
}
