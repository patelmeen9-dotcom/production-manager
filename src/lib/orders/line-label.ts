/** Display helpers for order lines after category reshape. */

export function formatCategoryDetail(line: {
  categorySelections?: {
    productCategory: { name: string };
    textValue: string | null;
    selectedOptions?: { categoryOption: { name: string } }[];
  }[];
}): string {
  const answers =
    line.categorySelections
      ?.map((selection) => {
        if (selection.textValue?.trim()) {
          return `${selection.productCategory.name}: ${selection.textValue.trim()}`;
        }
        const options = selection.selectedOptions?.map((row) => row.categoryOption.name) ?? [];
        if (options.length > 0) {
          return `${selection.productCategory.name}: ${options.join(", ")}`;
        }
        return null;
      })
      .filter(Boolean) ?? [];
  return answers.join(" · ");
}

export function formatOrderLineLabel(line: {
  product: { name: string };
  lineNumber?: number;
  categorySelections?: {
    productCategory: { name: string };
    textValue: string | null;
    selectedOptions?: { categoryOption: { name: string } }[];
  }[];
}): string {
  const detail = formatCategoryDetail(line);
  const prefix = line.lineNumber ? `Line ${line.lineNumber}: ${line.product.name}` : line.product.name;
  return detail ? `${prefix} (${detail})` : prefix;
}

export function formatOrderLineShort(line: { product: { name: string }; lineNumber?: number }): string {
  return line.product.name;
}
