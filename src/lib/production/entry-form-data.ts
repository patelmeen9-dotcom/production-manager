import { formatCategoryDetail, formatOrderLineLabel } from "@/lib/orders/line-label";
import type { EntryLineOption } from "@/components/production/production-entry-form";

type LineWithCategories = {
  id: string;
  lineNumber: number;
  product: { name: string };
  categorySelections?: {
    productCategory: { name: string };
    textValue: string | null;
    selectedOptions?: { categoryOption: { name: string } }[];
  }[];
  processes: {
    id: string;
    sequence: number;
    processName: string;
  }[];
};

export function buildEntryLinesByOrder(
  orders: {
    id: string;
    lines: LineWithCategories[];
  }[],
): Record<string, EntryLineOption[]> {
  return Object.fromEntries(
    orders.map((order) => [
      order.id,
      order.lines.map((line) => ({
        id: line.id,
        productName: line.product.name,
        label: formatOrderLineLabel(line),
        categoryDetail: formatCategoryDetail(line),
        stages: line.processes.map((process) => ({
          value: `process:${process.id}`,
          label: `${process.sequence}. ${process.processName}`,
        })),
      })),
    ]),
  );
}
