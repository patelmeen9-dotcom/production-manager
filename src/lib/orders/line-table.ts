/** Product × category quantity matrix for order lines. */

export type CategoryColumn = {
  id: string;
  name: string;
};

export type LineCategorySelection = {
  productCategoryId?: string;
  productCategory: { id?: string; name: string };
  textValue: string | null;
  selectedOptions?: { categoryOption: { name: string } }[];
};

export type LineForTable = {
  id: string;
  lineNumber: number;
  quantity: number;
  remarks?: string | null;
  product: {
    id?: string;
    name: string;
    details?: string | null;
    categoryAssignments?: { productCategory: { id: string; name: string } }[];
  };
  categorySelections?: LineCategorySelection[];
};

export function selectionCategoryId(selection: LineCategorySelection): string | null {
  return selection.productCategoryId ?? selection.productCategory.id ?? null;
}

export function lineCategoryIds(line: LineForTable): string[] {
  const ids: string[] = [];
  for (const selection of line.categorySelections ?? []) {
    const id = selectionCategoryId(selection);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Union of categories mapped to products on these lines, plus any selected categories.
 * Stable sort by category name.
 */
export function collectCategoryColumns(lines: LineForTable[]): CategoryColumn[] {
  const map = new Map<string, string>();
  for (const line of lines) {
    for (const assignment of line.product.categoryAssignments ?? []) {
      map.set(assignment.productCategory.id, assignment.productCategory.name);
    }
    for (const selection of line.categorySelections ?? []) {
      const id = selectionCategoryId(selection);
      if (id) {
        map.set(id, selection.productCategory.name);
      }
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type MatrixCell = {
  /** Quantity for this product + category; null means not on the order. */
  quantity: number | null;
  /** Product is mapped to this category (cell can exist). */
  applicable: boolean;
};

export type ProductCategoryMatrixRow = {
  productId: string;
  productName: string;
  details: string | null;
  cells: Record<string, MatrixCell>;
  total: number;
};

export type ProductCategoryMatrix = {
  columns: CategoryColumn[];
  rows: ProductCategoryMatrixRow[];
  orderTotal: number;
};

function productKey(line: LineForTable): string {
  return line.product.id || line.product.name;
}

/**
 * Rows = products on the order. Columns = mapped categories.
 * A line with exactly one category contributes its quantity to that cell.
 * Lines with no category (or multiple attribute-style categories) count only in the product total.
 */
export function buildProductCategoryMatrix(lines: LineForTable[]): ProductCategoryMatrix {
  const columns = collectCategoryColumns(lines);
  const rowMap = new Map<string, ProductCategoryMatrixRow>();

  for (const line of lines) {
    const id = productKey(line);
    const existing = rowMap.get(id);
    const mapped = new Set((line.product.categoryAssignments ?? []).map((row) => row.productCategory.id));
    const row =
      existing ??
      ({
        productId: id,
        productName: line.product.name,
        details: line.product.details ?? null,
        cells: Object.fromEntries(
          columns.map((column) => [
            column.id,
            { quantity: null as number | null, applicable: mapped.has(column.id) },
          ]),
        ),
        total: 0,
      } satisfies ProductCategoryMatrixRow);

    for (const column of columns) {
      if (!row.cells[column.id]) {
        row.cells[column.id] = { quantity: null, applicable: mapped.has(column.id) };
      }
      if (mapped.has(column.id)) {
        row.cells[column.id]!.applicable = true;
      }
    }

    row.total += line.quantity;
    const cats = lineCategoryIds(line);
    if (cats.length === 1) {
      const categoryId = cats[0]!;
      const cell = row.cells[categoryId] ?? { quantity: null, applicable: true };
      cell.applicable = true;
      cell.quantity = (cell.quantity ?? 0) + line.quantity;
      row.cells[categoryId] = cell;
    }
    rowMap.set(id, row);
  }

  const rows = [...rowMap.values()];
  const orderTotal = rows.reduce((sum, row) => sum + row.total, 0);
  return { columns, rows, orderTotal };
}

export function formatMatrixCell(cell: MatrixCell | undefined): string {
  if (!cell?.applicable || cell.quantity == null || cell.quantity <= 0) {
    return "-";
  }
  return String(cell.quantity);
}

export type MatrixEditorRow = {
  productId: string;
  productName: string;
  hasMappedCategories: boolean;
  cells: Record<string, { applicable: boolean; quantity: number | null }>;
  uncategorizedQuantity: number | null;
};

export type MatrixEditorModel = {
  columns: CategoryColumn[];
  rows: MatrixEditorRow[];
  orderTotal: number;
};

/** Editable product × category quantities, excluding legacy multi-category attribute lines. */
export function buildMatrixEditorModel(lines: LineForTable[]): MatrixEditorModel {
  const matrix = buildProductCategoryMatrix(lines);
  const rows: MatrixEditorRow[] = matrix.rows.map((row) => {
    const productLines = lines.filter((line) => productKey(line) === row.productId);
    const mapped = new Set(
      productLines.flatMap((line) => (line.product.categoryAssignments ?? []).map((item) => item.productCategory.id)),
    );
    const hasMappedCategories = mapped.size > 0;
    let uncategorizedQuantity: number | null = null;
    if (!hasMappedCategories) {
      uncategorizedQuantity = productLines
        .filter((line) => lineCategoryIds(line).length === 0)
        .reduce((sum, line) => sum + line.quantity, 0);
    }
    return {
      productId: row.productId,
      productName: row.productName,
      hasMappedCategories,
      cells: row.cells,
      uncategorizedQuantity,
    };
  });
  return { columns: matrix.columns, rows, orderTotal: matrix.orderTotal };
}
