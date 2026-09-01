import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { assertProcessesBelongToOrganization, buildProcessMappingSteps } from "@/lib/masters/process-mapping";

describe("plant/product process mapping", () => {
  it("assigns sequence from the given order, not from stage names", () => {
    const steps = buildProcessMappingSteps(["proc-cut", "proc-frame", "proc-assemble"]);
    expect(steps).toEqual([
      { processId: "proc-cut", sequence: 1 },
      { processId: "proc-frame", sequence: 2 },
      { processId: "proc-assemble", sequence: 3 },
    ]);
  });

  it("allows different plants to use different sequences for the same product", () => {
    const plantA = buildProcessMappingSteps(["cut", "frame", "assemble", "glass", "finish"]);
    const plantB = buildProcessMappingSteps(["cut", "cnc", "frame", "assemble", "finish"]);
    expect(plantA.map((step) => step.processId)).not.toEqual(plantB.map((step) => step.processId));
    expect(plantB[1]).toEqual({ processId: "cnc", sequence: 2 });
  });

  it("rejects duplicate processes in one mapping", () => {
    expect(() => buildProcessMappingSteps(["cut", "cut"])).toThrow(AppError);
  });

  it("rejects an empty mapping", () => {
    expect(() => buildProcessMappingSteps([])).toThrow(AppError);
  });

  it("rejects processes that are not in the organization", () => {
    expect(() => assertProcessesBelongToOrganization(["org-a-cut", "org-b-cnc"], ["org-a-cut"])).toThrow(AppError);
  });
});
