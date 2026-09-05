import { describe, expect, it } from "vitest";
import { DEFAULT_ORGANIZATION_SETTINGS } from "@/lib/organization-settings";
import { parseDateOnly } from "@/lib/orders/date-rules";
import { assertValidProductionEntry } from "@/lib/production/validate";
import { evaluateOrder, resolveStartStatus, timingFromExpectedDays } from "@/lib/production/engine";
import { AppError } from "@/lib/errors";

const processes = [
  { id: "cut", sequence: 1, processName: "Cutting", processCode: "CUT", plannedQuantity: 500 },
  { id: "frame", sequence: 2, processName: "Framing", processCode: "FRM", plannedQuantity: 500 },
  { id: "asm", sequence: 3, processName: "Assembly", processCode: "ASM", plannedQuantity: 500 },
  { id: "glass", sequence: 4, processName: "Glass", processCode: "GLS", plannedQuantity: 500 },
  { id: "fin", sequence: 5, processName: "Finishing", processCode: "FIN", plannedQuantity: 500 },
];

const settings = DEFAULT_ORGANIZATION_SETTINGS;

describe("incremental production", () => {
  it("sums incremental Cutting entries instead of treating the latest as cumulative", () => {
    const result = evaluateOrder({
      orderQuantity: 500,
      effectiveStartDate: parseDateOnly("2026-08-30"),
      resolvedDueDate: parseDateOnly("2026-09-20"),
      lifecycleStatus: "IN_PRODUCTION",
      processes,
      entries: [
        { orderProcessId: "cut", quantity: 200 },
        { orderProcessId: "cut", quantity: 300 },
        { orderProcessId: "frame", quantity: 150 },
      ],
      firstEntryDate: parseDateOnly("2026-08-30"),
      asOfDate: parseDateOnly("2026-08-31"),
      settings,
    });

    expect(result.stages.map((stage) => `${stage.processName}:${stage.cumulative}`)).toEqual([
      "Cutting:500",
      "Framing:150",
      "Assembly:0",
      "Glass:0",
      "Finishing:0",
    ]);
    expect(result.currentStageName).toBe("Framing");
    expect(result.completedQuantity).toBe(0);
    expect(result.remainingQuantity).toBe(500);
  });
});

describe("sequential validation", () => {
  it("rejects Framing 200 when Cutting cumulative is 100", () => {
    expect(() =>
      assertValidProductionEntry({
        quantity: 200,
        lifecycleStatus: "IN_PRODUCTION",
        processes,
        orderProcessId: "frame",
        existingEntries: [{ orderProcessId: "cut", quantity: 100 }],
      }),
    ).toThrow(AppError);
  });

  it("accepts Framing 150 when Cutting cumulative is 500", () => {
    expect(() =>
      assertValidProductionEntry({
        quantity: 150,
        lifecycleStatus: "NOT_STARTED",
        processes,
        orderProcessId: "frame",
        existingEntries: [
          { orderProcessId: "cut", quantity: 200 },
          { orderProcessId: "cut", quantity: 300 },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects zero and negative quantities", () => {
    expect(() =>
      assertValidProductionEntry({
        quantity: 0,
        lifecycleStatus: "NOT_STARTED",
        processes,
        orderProcessId: "cut",
        existingEntries: [],
      }),
    ).toThrow(AppError);
  });
});

describe("start delay", () => {
  const start = parseDateOnly("2026-08-30");

  it("does not flag a future start date", () => {
    expect(
      resolveStartStatus({
        lifecycleStatus: "NOT_STARTED",
        productionStarted: false,
        effectiveStartDate: parseDateOnly("2026-09-05"),
        asOfDate: parseDateOnly("2026-09-04"),
        settings,
      }),
    ).toBe("NOT_STARTED");
  });

  it("uses documented elapsed-day thresholds", () => {
    const statusOn = (asOf: string) =>
      resolveStartStatus({
        lifecycleStatus: "NOT_STARTED",
        productionStarted: false,
        effectiveStartDate: start,
        asOfDate: parseDateOnly(asOf),
        settings,
      });

    expect(statusOn("2026-08-30")).toBe("NOT_STARTED");
    expect(statusOn("2026-08-31")).toBe("NOT_STARTED");
    expect(statusOn("2026-09-01")).toBe("START_WARNING");
    expect(statusOn("2026-09-02")).toBe("START_WARNING");
    expect(statusOn("2026-09-04")).toBe("START_DELAYED");
    expect(statusOn("2026-09-05")).toBe("START_DELAYED");
  });
});

describe("production timing", () => {
  it("marks DELAYED only after the due date while incomplete", () => {
    const result = evaluateOrder({
      orderQuantity: 500,
      effectiveStartDate: parseDateOnly("2026-08-01"),
      resolvedDueDate: parseDateOnly("2026-08-10"),
      lifecycleStatus: "IN_PRODUCTION",
      processes,
      entries: [{ orderProcessId: "cut", quantity: 10 }],
      firstEntryDate: parseDateOnly("2026-08-01"),
      asOfDate: parseDateOnly("2026-08-11"),
      settings,
    });
    expect(result.displayStatus).toBe("DELAYED");
    expect(result.timingStatus).toBe("DELAYED");
  });

  it("does not mark DELAYED merely because production is slow before the due date", () => {
    const result = evaluateOrder({
      orderQuantity: 500,
      effectiveStartDate: parseDateOnly("2026-08-01"),
      resolvedDueDate: parseDateOnly("2026-09-30"),
      lifecycleStatus: "IN_PRODUCTION",
      processes,
      entries: [{ orderProcessId: "cut", quantity: 10 }],
      firstEntryDate: parseDateOnly("2026-08-01"),
      asOfDate: parseDateOnly("2026-08-05"),
      settings,
    });
    expect(result.timingStatus).not.toBe("DELAYED");
  });

  it("marks DELAYED when behind units-per-day plan", () => {
    // 500 units @ 250/day => 2 plan days for cutting; asOf day 4 with only 10 done => delayed
    const planned = processes.map((process, index) => ({
      ...process,
      unitsPerDay: index === 0 ? 250 : 100,
    }));
    const result = evaluateOrder({
      orderQuantity: 500,
      effectiveStartDate: parseDateOnly("2026-08-01"),
      resolvedDueDate: parseDateOnly("2026-09-30"),
      lifecycleStatus: "IN_PRODUCTION",
      processes: planned,
      entries: [{ orderProcessId: "cut", quantity: 10 }],
      firstEntryDate: parseDateOnly("2026-08-01"),
      asOfDate: parseDateOnly("2026-08-04"),
      settings,
    });
    expect(result.timingStatus).toBe("DELAYED");
    expect(result.displayStatus).toBe("DELAYED");
  });

  it("marks GETTING_DELAYED near the expected-days stage deadline", () => {
    const planned = processes.map((process) => ({ ...process, expectedDays: 5 }));
    const result = evaluateOrder({
      orderQuantity: 500,
      effectiveStartDate: parseDateOnly("2026-08-01"),
      resolvedDueDate: parseDateOnly("2026-09-30"),
      lifecycleStatus: "IN_PRODUCTION",
      processes: planned,
      entries: [{ orderProcessId: "cut", quantity: 10 }],
      firstEntryDate: parseDateOnly("2026-08-01"),
      asOfDate: parseDateOnly("2026-08-04"),
      settings,
    });
    expect(result.timingStatus).toBe("GETTING_DELAYED");
  });
});

describe("timingFromExpectedDays", () => {
  it("returns null when any stage lacks plan days and units/day", () => {
    expect(
      timingFromExpectedDays({
        stages: [
          {
            id: "cut",
            sequence: 1,
            processName: "Cutting",
            processCode: "CUT",
            plannedQuantity: 100,
            expectedDays: 2,
            cumulative: 0,
            remaining: 100,
            percentComplete: 0,
          },
          {
            id: "frame",
            sequence: 2,
            processName: "Framing",
            processCode: "FRM",
            plannedQuantity: 100,
            expectedDays: null,
            unitsPerDay: null,
            cumulative: 0,
            remaining: 100,
            percentComplete: 0,
          },
        ],
        effectiveStartDate: parseDateOnly("2026-08-01"),
        asOfDate: parseDateOnly("2026-08-10"),
        gettingDelayedLeadDays: settings.gettingDelayedLeadDays,
      }),
    ).toBeNull();
  });
});
