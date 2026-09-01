import type { StageState } from "@/lib/production/engine";

export type StageProgressPoint = {
  processCode: string;
  processName: string;
  cumulative: number;
  planned: number;
  /** Units that finished the previous stage but not this one (pipeline position). */
  sitting: number;
};

/**
 * Per-order stage progress from engine stage cumulatives.
 * "Completed at stage" = cumulative quantity recorded for that process.
 * "Sitting at stage" = max(0, prevCumulative - thisCumulative) for sequence stage > 1,
 * or orderQty - firstStageCumulative for the first incomplete pipeline slot when not started elsewhere.
 */
export function orderStageProgress(stages: StageState[], orderQuantity: number): StageProgressPoint[] {
  const sorted = [...stages].sort((a, b) => a.sequence - b.sequence);
  return sorted.map((stage, index) => {
    const prev = index === 0 ? orderQuantity : sorted[index - 1].cumulative;
    const sitting = Math.max(0, Math.min(prev, orderQuantity) - stage.cumulative);
    return {
      processCode: stage.processCode,
      processName: stage.processName,
      cumulative: stage.cumulative,
      planned: stage.plannedQuantity,
      sitting,
    };
  });
}

/**
 * Dashboard-wide rollup by process code across evaluated orders.
 * Different plant/product sequences may share codes; quantities are summed.
 */
export function aggregateStageProgress(
  rows: { orderQuantity: number; stages: StageState[] }[],
): StageProgressPoint[] {
  const map = new Map<string, StageProgressPoint & { sequences: number }>();

  for (const row of rows) {
    const points = orderStageProgress(row.stages, row.orderQuantity);
    for (const point of points) {
      const current = map.get(point.processCode) ?? {
        processCode: point.processCode,
        processName: point.processName,
        cumulative: 0,
        planned: 0,
        sitting: 0,
        sequences: 0,
      };
      current.cumulative += point.cumulative;
      current.planned += point.planned;
      current.sitting += point.sitting;
      current.sequences += 1;
      map.set(point.processCode, current);
    }
  }

  return [...map.values()]
    .map((point) => ({
      processCode: point.processCode,
      processName: point.processName,
      cumulative: point.cumulative,
      planned: point.planned,
      sitting: point.sitting,
    }))
    .sort((a, b) => b.cumulative - a.cumulative || a.processName.localeCompare(b.processName));
}
