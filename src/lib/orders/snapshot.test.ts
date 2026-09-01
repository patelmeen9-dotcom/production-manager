import { describe, expect, it } from "vitest";
import { buildOrderProcessSnapshot } from "@/lib/orders/snapshot";

describe("order process snapshot", () => {
  it("copies sequence and planned quantity from the mapping at creation time", () => {
    const snapshot = buildOrderProcessSnapshot(
      [
        { processId: "cut", sequence: 1, process: { name: "Cutting", code: "CUT" } },
        { processId: "frame", sequence: 2, process: { name: "Framing", code: "FRM" } },
      ],
      500,
    );
    expect(snapshot).toEqual([
      { processId: "cut", processName: "Cutting", processCode: "CUT", sequence: 1, plannedQuantity: 500 },
      { processId: "frame", processName: "Framing", processCode: "FRM", sequence: 2, plannedQuantity: 500 },
    ]);
  });

  it("does not change an existing snapshot when a later mapping would differ", () => {
    const created = buildOrderProcessSnapshot(
      [{ processId: "cut", sequence: 1, process: { name: "Cutting", code: "CUT" } }],
      500,
    );
    const laterMaster = buildOrderProcessSnapshot(
      [
        { processId: "cut", sequence: 1, process: { name: "Cutting", code: "CUT" } },
        { processId: "cnc", sequence: 2, process: { name: "CNC", code: "CNC" } },
      ],
      500,
    );
    expect(created).toHaveLength(1);
    expect(laterMaster).toHaveLength(2);
    expect(created.map((row) => row.processCode)).toEqual(["CUT"]);
  });
});
