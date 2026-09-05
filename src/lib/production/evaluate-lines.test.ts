import { describe, expect, it } from "vitest";
import { evaluateOrderLines, scopeProcessesToLine } from "@/lib/production/evaluate-lines";
import { DEFAULT_ORGANIZATION_SETTINGS } from "@/lib/organization-settings";
import { parseDateOnly } from "@/lib/orders/date-rules";

const settings = DEFAULT_ORGANIZATION_SETTINGS;

describe("multi-line order evaluation", () => {
  it("sums finished goods across product/category lines", () => {
    const result = evaluateOrderLines({
      orderQuantity: 400,
      effectiveStartDate: parseDateOnly("2026-08-30"),
      resolvedDueDate: parseDateOnly("2026-09-20"),
      lifecycleStatus: "IN_PRODUCTION",
      lines: [
        {
          id: "line-1",
          quantity: 100,
          label: "Door / Cat1",
          processes: [
            { id: "l1-cut", sequence: 1, processName: "Cutting", processCode: "CUT", plannedQuantity: 100 },
            { id: "l1-fin", sequence: 2, processName: "Finishing", processCode: "FIN", plannedQuantity: 100 },
          ],
        },
        {
          id: "line-2",
          quantity: 300,
          label: "Door / Cat2",
          processes: [
            { id: "l2-cut", sequence: 1, processName: "Cutting", processCode: "CUT", plannedQuantity: 300 },
            { id: "l2-fin", sequence: 2, processName: "Finishing", processCode: "FIN", plannedQuantity: 300 },
          ],
        },
      ],
      entries: [
        { orderProcessId: "l1-cut", quantity: 100 },
        { orderProcessId: "l1-fin", quantity: 100 },
        { orderProcessId: "l2-cut", quantity: 300 },
        { orderProcessId: "l2-fin", quantity: 150 },
      ],
      firstEntryDate: parseDateOnly("2026-08-30"),
      asOfDate: parseDateOnly("2026-08-31"),
      settings,
    });

    expect(result.completedQuantity).toBe(250);
    expect(result.remainingQuantity).toBe(150);
    expect(result.derivedLifecycle).toBe("IN_PRODUCTION");
    expect(result.stages.find((stage) => stage.processCode === "CUT")?.cumulative).toBe(400);
    expect(result.stages.find((stage) => stage.processCode === "FIN")?.cumulative).toBe(250);
  });

  it("scopes production validation inputs to the selected line", () => {
    const scoped = scopeProcessesToLine(
      [
        {
          id: "l1-cut",
          sequence: 1,
          processName: "Cutting",
          processCode: "CUT",
          plannedQuantity: 100,
          productionOrderLineId: "line-1",
        },
        {
          id: "l2-cut",
          sequence: 1,
          processName: "Cutting",
          processCode: "CUT",
          plannedQuantity: 300,
          productionOrderLineId: "line-2",
        },
      ],
      "l2-cut",
      [
        { orderProcessId: "l1-cut", quantity: 100 },
        { orderProcessId: "l2-cut", quantity: 50 },
      ],
    );

    expect(scoped.processes).toHaveLength(1);
    expect(scoped.processes[0]?.id).toBe("l2-cut");
    expect(scoped.entries).toEqual([{ orderProcessId: "l2-cut", quantity: 50 }]);
  });
});
