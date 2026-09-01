import Link from "next/link";

export type WeeklyOrderStageRow = {
  clientId: string;
  clientName: string;
  orders: {
    orderId: string;
    orderNumber: string;
    productName: string;
    stages: { processCode: string; processName: string; quantity: number }[];
  }[];
};

/**
 * Weekly panel: client → order → process quantities entered in the date range.
 * e.g. Client X / ORD-1 → Cutting:50, Framing:20
 */
export function WeeklyOrderStagePanel(props: { groups: WeeklyOrderStageRow[] }) {
  if (props.groups.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-faint">No production entries in this date range.</p>;
  }

  return (
    <div className="divide-y divide-line">
      {props.groups.map((client) => (
        <div key={client.clientId} className="px-4 py-3">
          <p className="text-[13px] font-semibold text-ink">{client.clientName}</p>
          <ul className="mt-2 space-y-2">
            {client.orders.map((order) => (
              <li key={order.orderId} className="text-[12.5px]">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Link href={`/orders/${order.orderId}`} className="font-mono font-medium text-accent hover:underline">
                    {order.orderNumber}
                  </Link>
                  <span className="text-ink-soft">{order.productName}</span>
                </div>
                <p className="mt-0.5 font-mono text-[12px] text-ink">
                  {order.stages.map((stage, index) => (
                    <span key={stage.processCode}>
                      {index > 0 ? <span className="text-ink-faint">, </span> : null}
                      <span className="text-ink-soft">{stage.processName}</span>
                      <span className="text-ink-faint">:</span>
                      {stage.quantity}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
