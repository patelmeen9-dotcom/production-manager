import { describe, expect, it } from "vitest";
import { buildMatrixEditorModel, buildProductCategoryMatrix, formatMatrixCell } from "@/lib/orders/line-table";

describe("product × category quantity matrix", () => {
  it("places quantity in the matching category cell and dashes unused combos", () => {
    const matrix = buildProductCategoryMatrix([
      {
        id: "l1",
        lineNumber: 1,
        quantity: 40,
        product: {
          id: "door",
          name: "Door",
          categoryAssignments: [
            { productCategory: { id: "cat-fill", name: "FILLER" } },
            { productCategory: { id: "cat-thick", name: "THICKNESS" } },
          ],
        },
        categorySelections: [
          {
            productCategoryId: "cat-fill",
            productCategory: { id: "cat-fill", name: "FILLER" },
            textValue: null,
          },
        ],
      },
      {
        id: "l2",
        lineNumber: 2,
        quantity: 20,
        product: {
          id: "door",
          name: "Door",
          categoryAssignments: [
            { productCategory: { id: "cat-fill", name: "FILLER" } },
            { productCategory: { id: "cat-thick", name: "THICKNESS" } },
          ],
        },
        categorySelections: [
          {
            productCategoryId: "cat-thick",
            productCategory: { id: "cat-thick", name: "THICKNESS" },
            textValue: null,
          },
        ],
      },
    ]);

    expect(matrix.columns.map((column) => column.name)).toEqual(["FILLER", "THICKNESS"]);
    expect(matrix.rows).toHaveLength(1);
    expect(formatMatrixCell(matrix.rows[0]!.cells["cat-fill"])).toBe("40");
    expect(formatMatrixCell(matrix.rows[0]!.cells["cat-thick"])).toBe("20");
    expect(matrix.rows[0]!.total).toBe(60);
    expect(matrix.orderTotal).toBe(60);
  });

  it("does not split a multi-category attribute line across quantity columns", () => {
    const matrix = buildProductCategoryMatrix([
      {
        id: "l1",
        lineNumber: 1,
        quantity: 40,
        product: {
          id: "door",
          name: "Door",
          categoryAssignments: [
            { productCategory: { id: "cat-fill", name: "FILLER" } },
            { productCategory: { id: "cat-thick", name: "THICKNESS" } },
          ],
        },
        categorySelections: [
          {
            productCategoryId: "cat-fill",
            productCategory: { id: "cat-fill", name: "FILLER" },
            textValue: "Honeycomb",
          },
          {
            productCategoryId: "cat-thick",
            productCategory: { id: "cat-thick", name: "THICKNESS" },
            textValue: "35",
          },
        ],
      },
    ]);
    expect(formatMatrixCell(matrix.rows[0]!.cells["cat-fill"])).toBe("-");
    expect(formatMatrixCell(matrix.rows[0]!.cells["cat-thick"])).toBe("-");
    expect(matrix.rows[0]!.total).toBe(40);
    expect(matrix.orderTotal).toBe(40);
  });

  it("uses total as the editable quantity when a product has no mapped categories", () => {
    const model = buildMatrixEditorModel([
      {
        id: "l1",
        lineNumber: 1,
        quantity: 12,
        product: { id: "panel", name: "Panel", categoryAssignments: [] },
        categorySelections: [],
      },
    ]);
    expect(model.columns).toEqual([]);
    expect(model.rows[0]!.hasMappedCategories).toBe(false);
    expect(model.rows[0]!.uncategorizedQuantity).toBe(12);
    expect(model.orderTotal).toBe(12);
  });
});
