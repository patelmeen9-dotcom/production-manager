import { buildProductCategoryMatrix, formatMatrixCell, type LineForTable } from "@/lib/orders/line-table";

export function OrderLinesTable(props: { lines: LineForTable[] }) {
  const matrix = buildProductCategoryMatrix(props.lines);

  if (matrix.rows.length === 0) {
    return <p className="p-4 text-sm text-ink-faint">No order lines on this order.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-[13px]">
        <thead className="border-b border-line bg-panel-muted text-[10.5px] font-semibold uppercase tracking-wide text-ink-soft">
          <tr>
            <th className="whitespace-nowrap px-3 py-2.5">Product</th>
            {matrix.columns.map((column) => (
              <th key={column.id} className="whitespace-nowrap px-3 py-2.5 text-right">
                {column.name}
              </th>
            ))}
            <th className="whitespace-nowrap px-3 py-2.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.productId} className="border-b border-line">
              <td className="px-3 py-2.5">
                <p className="font-medium text-ink">{row.productName}</p>
                {row.details ? <p className="text-[11px] text-ink-soft">{row.details}</p> : null}
              </td>
              {matrix.columns.map((column) => (
                <td key={column.id} className="px-3 py-2.5 text-right font-mono text-ink-soft">
                  {formatMatrixCell(row.cells[column.id]) === "-" ? (
                    <span className="text-ink-faint">-</span>
                  ) : (
                    <span className="text-ink">{formatMatrixCell(row.cells[column.id])}</span>
                  )}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-mono font-medium text-ink">{row.total}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-panel-muted">
            <td className="px-3 py-2.5 text-[12px] font-semibold text-ink">Total order quantity</td>
            {matrix.columns.map((column) => (
              <td key={column.id} className="px-3 py-2.5" />
            ))}
            <td className="px-3 py-2.5 text-right font-mono text-[15px] font-semibold text-ink">{matrix.orderTotal}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
