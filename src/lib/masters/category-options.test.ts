import { describe, expect, it } from "vitest";
import { planCategoryOptionSync } from "@/lib/masters/category-options";

describe("planCategoryOptionSync", () => {
  it("updates existing options by id instead of treating them as new rows", () => {
    const plan = planCategoryOptionSync(
      [
        { id: "opt-1", code: "30MM" },
        { id: "opt-2", code: "35MM" },
      ],
      [
        { id: "opt-1", code: "30MM" },
        { id: "opt-2", code: "40MM" },
      ],
    );
    expect(plan.updates).toEqual([
      { id: "opt-1", incomingIndex: 0 },
      { id: "opt-2", incomingIndex: 1 },
    ]);
    expect(plan.creates).toEqual([]);
    expect(plan.removeIds).toEqual([]);
  });

  it("creates new codes and marks unmatched existing options for removal", () => {
    const plan = planCategoryOptionSync([{ id: "opt-1", code: "30MM" }], [
      { id: "opt-1", code: "30MM" },
      { code: "PINE" },
    ]);
    expect(plan.updates).toEqual([{ id: "opt-1", incomingIndex: 0 }]);
    expect(plan.creates).toEqual([1]);
    expect(plan.removeIds).toEqual([]);
  });

  it("matches by code when the submitted id is missing", () => {
    const plan = planCategoryOptionSync([{ id: "opt-1", code: "PINE" }], [{ code: "pine" }]);
    expect(plan.updates).toEqual([{ id: "opt-1", incomingIndex: 0 }]);
    expect(plan.removeIds).toEqual([]);
  });

  it("lists existing options that were removed from the form", () => {
    const plan = planCategoryOptionSync(
      [
        { id: "opt-1", code: "30MM" },
        { id: "opt-2", code: "35MM" },
      ],
      [{ id: "opt-1", code: "30MM" }],
    );
    expect(plan.removeIds).toEqual(["opt-2"]);
  });
});
