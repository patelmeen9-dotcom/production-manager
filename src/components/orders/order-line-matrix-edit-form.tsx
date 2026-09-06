"use client";

import { useMemo, useState } from "react";
import { updateOrderLineMatrixAction } from "@/lib/orders/actions";
import { ActionForm } from "@/components/masters/action-form";
import type { MatrixEditorModel } from "@/lib/orders/line-table";

function parseQty(value: string): number {
  const qty = Number(value);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

export function OrderLineMatrixEditForm(props: { orderId: string; model: MatrixEditorModel }) {
  const action = updateOrderLineMatrixAction.bind(null, props.orderId);
  const [rows, setRows] = useState(() =>
    props.model.rows.map((row) => ({
      ...row,
      cellQty: Object.fromEntries(
        Object.entries(row.cells).map(([id, cell]) => [id, cell.quantity != null && cell.quantity > 0 ? String(cell.quantity) : ""]),
      ),
      uncategorizedQty: row.uncategorizedQuantity != null && row.uncategorizedQuantity > 0 ? String(row.uncategorizedQuantity) : "",
    })),
  );

  const orderTotal = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (!row.hasMappedCategories) {
          return sum + parseQty(row.uncategorizedQty);
        }
        return sum + Object.values(row.cellQty).reduce((inner, value) => inner + parseQty(value), 0);
      }, 0),
    [rows],
  );

  const matrixJson = JSON.stringify(
    rows.flatMap((row) => {
      if (!row.hasMappedCategories) {
        return [{ productId: row.productId, categoryId: null as string | null, quantity: parseQty(row.uncategorizedQty) }];
      }
      return props.model.columns
        .filter((column) => row.cells[column.id]?.applicable)
        .map((column) => ({
          productId: row.productId,
          categoryId: column.id as string | null,
          quantity: parseQty(row.cellQty[column.id] ?? ""),
        }));
    }),
  );

  return (
    <ActionForm action={action} submitLabel="Save quantities">
      <input type="hidden" name="matrixJson" value={matrixJson} />
      <p className="text-sm text-slate-400">
        Edit quantities in the matrix. Blank cells stay as -. Filling a dash creates a line for that product and
        category using the existing process snapshot. Production has not started, so quantities can still change.
      </p>
      <div className="mt-3 overflow-x-auto rounded-md border border-slate-700">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-700 bg-slate-900/80 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Product</th>
              {props.model.columns.map((column) => (
                <th key={column.id} className="px-3 py-2 text-right">
                  {column.name}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const rowTotal = row.hasMappedCategories
                ? Object.values(row.cellQty).reduce((sum, value) => sum + parseQty(value), 0)
                : parseQty(row.uncategorizedQty);
              return (
                <tr key={row.productId} className="border-b border-slate-800">
                  <td className="px-3 py-2 font-medium text-white">{row.productName}</td>
                  {props.model.columns.map((column) => {
                    const applicable = Boolean(row.cells[column.id]?.applicable);
                    return (
                      <td key={column.id} className="px-3 py-2 text-right">
                        {applicable ? (
                          <input
                            type="number"
                            min={1}
                            value={row.cellQty[column.id] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setRows((current) =>
                                current.map((item, index) =>
                                  index === rowIndex
                                    ? { ...item, cellQty: { ...item.cellQty, [column.id]: value } }
                                    : item,
                                ),
                              );
                            }}
                            className="ml-auto w-20 rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-right text-sm"
                            placeholder="-"
                          />
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono text-slate-200">
                    {row.hasMappedCategories ? (
                      rowTotal || "-"
                    ) : (
                      <input
                        type="number"
                        min={1}
                        value={row.uncategorizedQty}
                        onChange={(event) => {
                          const value = event.target.value;
                          setRows((current) =>
                            current.map((item, index) => (index === rowIndex ? { ...item, uncategorizedQty: value } : item)),
                          );
                        }}
                        className="ml-auto w-20 rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-right text-sm"
                        placeholder="qty"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900/80">
              <td className="px-3 py-2 text-xs font-semibold text-slate-200">Total order quantity</td>
              {props.model.columns.map((column) => (
                <td key={column.id} />
              ))}
              <td className="px-3 py-2 text-right font-mono font-semibold text-white">{orderTotal || "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ActionForm>
  );
}
