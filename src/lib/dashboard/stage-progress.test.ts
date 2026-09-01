import { describe, expect, it } from "vitest";
import { aggregateStageProgress, orderStageProgress } from "@/lib/dashboard/stage-progress";
import type { StageState } from "@/lib/production/engine";

function stage(
  partial: Pick<StageState, "id" | "sequence" | "processCode" | "processName" | "cumulative" | "plannedQuantity">,
): StageState {
  return {
    ...partial,
    remaining: Math.max(partial.plannedQuantity - partial.cumulative, 0),
    percentComplete: partial.plannedQuantity === 0 ? 0 : (partial.cumulative / partial.plannedQuantity) * 100,
  };
}

describe("orderStageProgress", () => {
  it("reports cumulative completion and sitting quantity per stage", () => {
    const stages = [
      stage({ id: "1", sequence: 1, processCode: "CUT", processName: "Cutting", cumulative: 500, plannedQuantity: 500 }),
      stage({ id: "2", sequence: 2, processCode: "FRM", processName: "Framing", cumulative: 150, plannedQuantity: 500 }),
      stage({ id: "3", sequence: 3, processCode: "ASM", processName: "Assembly", cumulative: 0, plannedQuantity: 500 }),
    ];
    const points = orderStageProgress(stages, 500);
    expect(points[0]).toMatchObject({ processCode: "CUT", cumulative: 500, sitting: 0 });
    expect(points[1]).toMatchObject({ processCode: "FRM", cumulative: 150, sitting: 350 });
    expect(points[2]).toMatchObject({ processCode: "ASM", cumulative: 0, sitting: 150 });
  });
});

describe("aggregateStageProgress", () => {
  it("sums cumulatives across orders by process code", () => {
    const rows = [
      {
        orderQuantity: 500,
        stages: [
          stage({ id: "1", sequence: 1, processCode: "CUT", processName: "Cutting", cumulative: 200, plannedQuantity: 500 }),
        ],
      },
      {
        orderQuantity: 100,
        stages: [
          stage({ id: "2", sequence: 1, processCode: "CUT", processName: "Cutting", cumulative: 100, plannedQuantity: 100 }),
        ],
      },
    ];
    expect(aggregateStageProgress(rows)[0]).toMatchObject({ processCode: "CUT", cumulative: 300, planned: 600 });
  });
});
