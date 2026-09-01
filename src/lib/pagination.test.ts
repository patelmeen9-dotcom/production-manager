import { describe, expect, it } from "vitest";
import { buildPageHref, parsePageParam, parsePageSizeParam, toPageParams, totalPages } from "@/lib/pagination";

describe("pagination helpers", () => {
  it("clamps invalid pages to 1", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("4")).toBe(4);
  });

  it("caps page size", () => {
    expect(parsePageSizeParam("500")).toBe(100);
    expect(parsePageSizeParam("25")).toBe(25);
  });

  it("computes skip from page", () => {
    expect(toPageParams({ page: "3", pageSize: "20" })).toEqual({ page: 3, pageSize: 20, skip: 40 });
  });

  it("computes total pages without returning zero", () => {
    expect(totalPages(0, 50)).toBe(1);
    expect(totalPages(101, 50)).toBe(3);
  });

  it("builds stable list hrefs", () => {
    expect(buildPageHref("/entries", 1, { from: "2026-08-01", page: "9" })).toBe("/entries?from=2026-08-01");
    expect(buildPageHref("/orders", 2, {})).toBe("/orders?page=2");
  });
});
