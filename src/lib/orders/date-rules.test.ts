import { describe, expect, it } from "vitest";
import { parseDateOnly, resolveDueDate, resolveEffectiveStartDate } from "@/lib/orders/date-rules";

const orderDate = parseDateOnly("2026-08-30");

describe("production start date", () => {
  it("uses the order date when no start date is supplied", () => {
    const effective = resolveEffectiveStartDate({
      orderDate,
      startDateType: "NONE",
    });
    expect(effective).toEqual(orderDate);
  });

  it("uses a supplied future start date", () => {
    const startDate = parseDateOnly("2026-09-05");
    const effective = resolveEffectiveStartDate({
      orderDate,
      startDateType: "FIXED_DATE",
      startDate,
    });
    expect(effective).toEqual(startDate);
  });

  it("adds days from the order date when that input method is used", () => {
    const effective = resolveEffectiveStartDate({
      orderDate,
      startDateType: "DAYS_FROM_ORDER",
      startDays: 6,
    });
    expect(effective).toEqual(parseDateOnly("2026-09-05"));
  });
});

describe("due date", () => {
  it("stores a fixed due date", () => {
    const dueDate = parseDateOnly("2026-09-20");
    expect(
      resolveDueDate({
        orderDate,
        effectiveStartDate: orderDate,
        dueDateType: "FIXED_DATE",
        dueDate,
      }),
    ).toEqual(dueDate);
  });

  it("calculates due date from days after order date", () => {
    expect(
      resolveDueDate({
        orderDate,
        effectiveStartDate: orderDate,
        dueDateType: "DAYS_FROM_ORDER",
        dueDays: 10,
      }),
    ).toEqual(parseDateOnly("2026-09-09"));
  });

  it("calculates due date from days after effective production start", () => {
    const effectiveStartDate = parseDateOnly("2026-09-05");
    expect(
      resolveDueDate({
        orderDate,
        effectiveStartDate,
        dueDateType: "DAYS_FROM_START",
        dueDays: 21,
      }),
    ).toEqual(parseDateOnly("2026-09-26"));
  });

  it("uses order date as effective start when no production start is supplied", () => {
    expect(
      resolveDueDate({
        orderDate,
        effectiveStartDate: orderDate,
        dueDateType: "DAYS_FROM_START",
        dueDays: 7,
      }),
    ).toEqual(parseDateOnly("2026-09-06"));
  });
});
