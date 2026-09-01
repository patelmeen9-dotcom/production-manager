"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { displayStatusLabel, type DisplayStatus } from "@/lib/production/engine";
import type { StageProgressPoint } from "@/lib/dashboard/stage-progress";

export type LiveOrderRow = {
  id: string;
  orderNumber: string;
  clientName: string;
  productName: string;
  plantName: string;
  quantity: number;
  completedQuantity: number;
  remainingQuantity: number;
  progressPercent: number;
  currentStageName: string | null;
  dueDate: string;
  daysToDue: number;
  expectedCompletion: string | null;
  status: DisplayStatus;
  stages: StageProgressPoint[];
};

const STATUS_STYLE: Record<DisplayStatus, string> = {
  ON_TIME: "bg-on-time-bg text-on-time",
  GETTING_DELAYED: "bg-warn-bg text-warn",
  DELAYED: "bg-delayed-bg text-delayed",
  NOT_STARTED: "bg-accent-bg text-ink-soft",
  START_WARNING: "bg-warn-bg text-warn",
  START_DELAYED: "bg-delayed-bg text-delayed",
  COMPLETED: "bg-accent-bg text-ink-soft",
  CANCELLED: "bg-panel-muted text-ink-faint",
  ON_HOLD: "bg-panel-muted text-ink-faint",
};

function DueLabel({ days }: { days: number }) {
  if (days < 0) {
    return <span className="font-mono text-delayed">{Math.abs(days)}d over</span>;
  }
  if (days === 0) {
    return <span className="font-mono text-warn">Due today</span>;
  }
  return <span className="font-mono text-ink">{days}d left</span>;
}

function StageBars({ stages, orderQty }: { stages: StageProgressPoint[]; orderQty: number }) {
  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const pct = orderQty === 0 ? 0 : Math.min(100, (stage.cumulative / orderQty) * 100);
        return (
          <div key={stage.processCode} className="flex items-center gap-3">
            <div className="w-28 shrink-0 text-xs text-ink-soft">{stage.processName}</div>
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-line">
              <div className="h-full rounded-sm bg-on-time" style={{ width: `${pct}%` }} />
            </div>
            <div className="w-28 shrink-0 font-mono text-[11px] text-ink-soft">
              {stage.cumulative}/{orderQty}
              {stage.sitting > 0 ? ` · ${stage.sitting} waiting` : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LiveTrackingTable(props: { rows: LiveOrderRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (props.rows.length === 0) {
    return <p className="p-4 text-sm text-ink-faint">No orders match the current filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[20px_110px_1.2fr_1fr_80px_120px_90px_140px] gap-3 border-b border-line px-3.5 py-2 text-[10.5px] font-semibold tracking-wide text-ink-soft">
          <span />
          <span>Order</span>
          <span>Client</span>
          <span>Product</span>
          <span>Qty</span>
          <span>Progress</span>
          <span>Due</span>
          <span>Status</span>
        </div>
        {props.rows.map((row) => {
          const expanded = expandedId === row.id;
          const flagged = row.status === "DELAYED" || row.status === "START_DELAYED" || row.status === "GETTING_DELAYED" || row.status === "START_WARNING";
          return (
            <div key={row.id} className={`border-b border-line ${flagged ? "bg-delayed-bg/40" : ""}`}>
              <button
                type="button"
                className="grid w-full grid-cols-[20px_110px_1.2fr_1fr_80px_120px_90px_140px] items-center gap-3 px-3.5 py-2.5 text-left text-[13px] hover:bg-panel-muted"
                onClick={() => setExpandedId(expanded ? null : row.id)}
              >
                <span className="text-ink-soft">
                  {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
                <Link
                  href={`/orders/${row.id}`}
                  className="font-mono font-semibold text-accent hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.orderNumber}
                </Link>
                <span className="truncate text-ink">{row.clientName}</span>
                <span className="truncate text-ink-soft">{row.productName}</span>
                <span className="font-mono text-ink-soft">{row.quantity}</span>
                <span>
                  <div className="mb-1 text-[11px] text-ink-soft">{row.progressPercent.toFixed(0)}% done</div>
                  <div className="h-1 overflow-hidden rounded-sm bg-line">
                    <div className="h-full bg-on-time" style={{ width: `${row.progressPercent}%` }} />
                  </div>
                </span>
                <DueLabel days={row.daysToDue} />
                <span className={`inline-flex w-fit rounded px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_STYLE[row.status]}`}>
                  {displayStatusLabel(row.status)}
                </span>
              </button>
              {expanded ? (
                <div className="space-y-3 bg-panel-muted px-3.5 pb-4 pl-11 pt-1">
                  <div className="flex flex-wrap gap-x-8 gap-y-1 text-[11.5px] text-ink-soft">
                    <span>
                      <span className="font-semibold text-ink">Plant: </span>
                      {row.plantName}
                    </span>
                    <span>
                      <span className="font-semibold text-ink">Due date: </span>
                      {row.dueDate}
                    </span>
                    <span>
                      <span className="font-semibold text-ink">Stage: </span>
                      {row.currentStageName ?? "—"}
                    </span>
                    <span>
                      <span className="font-semibold text-ink">Expected: </span>
                      {row.expectedCompletion ?? "Not enough rate data"}
                    </span>
                    <span>
                      <span className="font-semibold text-ink">Done / pending: </span>
                      {row.completedQuantity} / {row.remainingQuantity}
                    </span>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-ink">Units completed by process</p>
                    <StageBars stages={row.stages} orderQty={row.quantity} />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
