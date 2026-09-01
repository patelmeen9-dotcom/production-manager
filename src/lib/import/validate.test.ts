import { describe, expect, it } from "vitest";
import { validateImportWorkbook } from "@/lib/import/validate";
import type { OrgCatalog } from "@/lib/import/validate";
import type { ParsedWorkbook } from "@/lib/import/types";

const emptyWorkbook = (): ParsedWorkbook => ({
  plants: [],
  clients: [],
  products: [],
  processes: [],
  mappings: [],
  specialActivities: [],
  projects: [],
  productionEntries: [],
  specialActivityEntries: [],
});

const catalog: OrgCatalog = {
  plants: [{ id: "p1", code: "PLANT-MUM", name: "Mumbai" }],
  clients: [{ id: "c1", code: "CLIENT-01", name: "Client A" }],
  products: [{ id: "pr1", code: "DOOR", name: "Door" }],
  processes: [
    { id: "cut", code: "CUT", name: "Cutting" },
    { id: "frm", code: "FRM", name: "Framing" },
  ],
  specialActivities: [],
  mappings: [{ plantCode: "PLANT-MUM", productCode: "DOOR", processCodes: ["CUT", "FRM"] }],
  orders: [
    {
      id: "o1",
      orderNumber: "ABC-001",
      plantCode: "PLANT-MUM",
      quantity: 500,
      lifecycleStatus: "IN_PRODUCTION",
      processes: [
        { id: "s1", processCode: "CUT", sequence: 1, processName: "Cutting", plannedQuantity: 500 },
        { id: "s2", processCode: "FRM", sequence: 2, processName: "Framing", plannedQuantity: 500 },
      ],
      entries: [],
    },
  ],
  grantedPlantCodes: null,
};

describe("excel import validation", () => {
  it("keeps historical production entries incremental and sequential", () => {
    const workbook = emptyWorkbook();
    workbook.productionEntries = [
      {
        __row: "3",
        ProjectCode: "ABC-001",
        ProcessCode: "CUT",
        EntryDate: "2026-08-30",
        Quantity: "200",
      },
      {
        __row: "4",
        ProjectCode: "ABC-001",
        ProcessCode: "CUT",
        EntryDate: "2026-08-31",
        Quantity: "300",
      },
      {
        __row: "5",
        ProjectCode: "ABC-001",
        ProcessCode: "FRM",
        EntryDate: "2026-08-31",
        Quantity: "150",
      },
    ];

    const result = validateImportWorkbook(workbook, catalog, "CREATE_OR_UPDATE");
    expect(result.issues.filter((issue) => issue.level === "error")).toHaveLength(0);
    expect(result.payload.productionEntries).toHaveLength(3);
    expect(result.payload.productionEntries.map((row) => row.quantity)).toEqual([200, 300, 150]);
  });

  it("rejects downstream quantity that exceeds upstream cumulative", () => {
    const workbook = emptyWorkbook();
    const withPartial = {
      ...catalog,
      orders: [
        {
          ...catalog.orders[0],
          entries: [{ orderProcessId: "s1", quantity: 100 }],
        },
      ],
    };
    workbook.productionEntries = [
      {
        __row: "2",
        ProjectCode: "ABC-001",
        ProcessCode: "FRM",
        EntryDate: "2026-08-31",
        Quantity: "200",
      },
    ];
    const result = validateImportWorkbook(workbook, withPartial, "CREATE_OR_UPDATE");
    expect(result.issues.some((issue) => issue.sheet === "ProductionEntries" && issue.level === "error")).toBe(true);
  });

  it("does not allow an unknown process code on an order snapshot", () => {
    const workbook = emptyWorkbook();
    workbook.productionEntries = [
      {
        __row: "2",
        ProjectCode: "ABC-001",
        ProcessCode: "CNC",
        EntryDate: "2026-08-31",
        Quantity: "10",
      },
    ];
    const result = validateImportWorkbook(workbook, catalog, "CREATE_OR_UPDATE");
    expect(result.issues[0]?.error).toMatch(/does not exist on this order's process snapshot/i);
  });

  it("warns instead of replacing an existing historical process snapshot", () => {
    const workbook = emptyWorkbook();
    workbook.projects = [
      {
        __row: "2",
        ProjectCode: "ABC-001",
        ClientCode: "CLIENT-01",
        PlantCode: "PLANT-MUM",
        ProductCode: "DOOR",
        Quantity: "500",
        OrderDate: "2026-08-30",
        StartDateType: "NONE",
        DueDateType: "DAYS_FROM_ORDER",
        DueDays: "21",
        ProcessCodes: "CUT|CNC|FRM",
      },
    ];
    const result = validateImportWorkbook(workbook, catalog, "CREATE_OR_UPDATE");
    expect(result.payload.projects[0]?.preserveExistingSnapshot).toBe(true);
    expect(result.issues.some((issue) => /snapshot differs/i.test(issue.error))).toBe(true);
  });

  it("blocks unauthorized plant references", () => {
    const workbook = emptyWorkbook();
    workbook.projects = [
      {
        __row: "2",
        ProjectCode: "NEW-001",
        ClientCode: "CLIENT-01",
        PlantCode: "PLANT-MUM",
        ProductCode: "DOOR",
        Quantity: "10",
        OrderDate: "2026-08-30",
        StartDateType: "NONE",
        DueDateType: "DAYS_FROM_ORDER",
        DueDays: "7",
        ProcessCodes: "CUT|FRM",
      },
    ];
    const restricted = { ...catalog, grantedPlantCodes: new Set(["OTHER"]) };
    const result = validateImportWorkbook(workbook, restricted, "CREATE_OR_UPDATE");
    expect(result.issues.some((issue) => /do not have access/i.test(issue.error))).toBe(true);
  });
});
