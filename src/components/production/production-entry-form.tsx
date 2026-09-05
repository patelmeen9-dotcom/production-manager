"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createProductionEntryAction } from "@/lib/production/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/masters/fields";

export type EntryLineOption = {
  id: string;
  productName: string;
  /** Full label for the product select (product + categories). */
  label: string;
  /** Category detail text shown under the product select. */
  categoryDetail: string;
  stages: { value: string; label: string }[];
};

export function ProductionEntryForm(props: {
  orders: { id: string; orderNumber: string }[];
  /** Order lines (products) with category detail and their stages. */
  linesByOrder: Record<string, EntryLineOption[]>;
  /** Order-level special activities shown after a product is selected. */
  activitiesByOrder?: Record<string, { value: string; label: string }[]>;
  defaultOrderId?: string;
  /** When editing an existing production entry. */
  entry?: {
    id: string;
    productionOrderId: string;
    orderProcessId: string;
    lineId?: string;
    entryDate: string;
    quantity: number;
    remarks: string | null;
  };
  action?: (state: { error?: string; success?: string }, formData: FormData) => Promise<{ error?: string; success?: string }>;
  submitLabel?: string;
  showBackToList?: boolean;
}) {
  const action = props.action ?? createProductionEntryAction;
  const [orderId, setOrderId] = useState(props.entry?.productionOrderId ?? props.defaultOrderId ?? props.orders[0]?.id ?? "");
  const lines = useMemo(() => props.linesByOrder[orderId] ?? [], [orderId, props.linesByOrder]);
  const activities = useMemo(() => props.activitiesByOrder?.[orderId] ?? [], [orderId, props.activitiesByOrder]);

  const initialLineId =
    props.entry?.lineId ??
    lines.find((line) => line.stages.some((stage) => stage.value === `process:${props.entry?.orderProcessId}`))?.id ??
    "";
  const [lineId, setLineId] = useState(initialLineId);
  const [lineDropdownOpen, setLineDropdownOpen] = useState(false);
  const lineDropdownRef = useRef<HTMLDivElement>(null);
  const selectedLine = useMemo(() => lines.find((line) => line.id === lineId) ?? null, [lines, lineId]);
  /*const stageOptions = useMemo(() => {
    if (!selectedLine) {
      return [];
    }
    return [...selectedLine.stages, ...activities];
  }, [selectedLine, activities]);*/
  useEffect(() => {
    if (!lineDropdownOpen) return;
  
    const handleClickOutside = (event: MouseEvent) => {
      if (
        lineDropdownRef.current &&
        !lineDropdownRef.current.contains(event.target as Node)
      ) {
        setLineDropdownOpen(false);
      }
    };
  
    document.addEventListener("mousedown", handleClickOutside);
  
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [lineDropdownOpen]);
  
  const stageOptions = useMemo(() => {
    if (!selectedLine) {
      return [];
    }
  
    return [...selectedLine.stages, ...activities];
  }, [selectedLine, activities]);


  const defaultStage = props.entry ? `process:${props.entry.orderProcessId}` : "";

  return (
    <div className="space-y-3">
      <ActionForm action={action} submitLabel={props.submitLabel ?? "Save incremental entry"}>
        {props.entry ? <input type="hidden" name="entryId" value={props.entry.id} /> : null}
        <FormGrid>
          <div>
            <Label htmlFor="productionOrderId">Order</Label>
            <select
              id="productionOrderId"
              name="productionOrderId"
              required
              value={orderId}
              onChange={(event) => {
                setOrderId(event.target.value);
                setLineId("");
              }}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              disabled={Boolean(props.entry)}
            >
              <option value="">Please select</option>
              {props.orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="orderLineId">Product / line</Label>
            {/*<select
              id="orderLineId"
              name="orderLineId"
              required
              value={lineId}
              onChange={(event) => setLineId(event.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              disabled={!orderId || Boolean(props.entry)}
            >
              <option value="">Please select</option>
              {lines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.label}
                </option>
              ))}
            </select>*/}
            <div ref={lineDropdownRef} className="relative">
  {/* Keep the real field for form submission */}
  <select
    id="orderLineId"
    name="orderLineId"
    required
    value={lineId}
    onChange={(event) => setLineId(event.target.value)}
    className="pointer-events-none absolute h-0 w-0 opacity-0"
    tabIndex={-1}
    aria-hidden="true"
  >
    <option value="">Please select</option>
    {lines.map((line) => (
      <option key={line.id} value={line.id}>
        {line.label}
      </option>
    ))}
  </select>

  <button
    type="button"
    disabled={!orderId || Boolean(props.entry)}
    onClick={() => setLineDropdownOpen((open) => !open)}
    className="flex w-full items-center justify-between rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-left text-sm"
  >
    {selectedLine ? (
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-100">
          Line {lines.findIndex((line) => line.id === lineId) + 1} ·{" "}
          {selectedLine.productName}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {selectedLine.categoryDetail}
        </p>
      </div>
    ) : (
      <span className="text-slate-400">Please select</span>
    )}

    <span className="ml-2 text-slate-400">⌄</span>
  </button>

  {lineDropdownOpen && (
    <div className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-slate-700 bg-slate-900 p-1 shadow-xl">
      {lines.map((line, index) => (
        <button
          key={line.id}
          type="button"
          onClick={() => {
            setLineId(line.id);
            setLineDropdownOpen(false);
          }}
          className={`w-full rounded-md px-3 py-3 text-left hover:bg-slate-800 ${
            line.id === lineId ? "bg-slate-800" : ""
          }`}
        >
          <p className="font-medium text-slate-100">
            Line {index + 1} · {line.productName}
          </p>

          {line.categoryDetail ? (
            <p className="mt-1 whitespace-normal text-xs leading-5 text-slate-400">
              {line.categoryDetail}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              No category details specified.
            </p>
          )}
        </button>
      ))}
    </div>
  )}
</div>

            {selectedLine ? (
              <div className="mt-2 rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
                <p className="font-medium text-slate-200">{selectedLine.productName}</p>
                <p className="mt-1 text-slate-400">
                  {selectedLine.categoryDetail || "No category details specified for this line."}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Select a product line to see its category details.</p>
            )}
          </div>

          <div>
            <Label htmlFor="stageOrActivity">Stage or special activity</Label>
            <select
              id="stageOrActivity"
              name="stageOrActivity"
              required
              key={`${orderId}:${lineId}:${defaultStage}`}
              defaultValue={defaultStage}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              disabled={!lineId}
            >
              <option value="">Please select</option>
              {stageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Stages are for the selected product line. Special activities (if any) are order-level.
            </p>
          </div>

          <TextField
            name="quantity"
            label="Quantity completed"
            type="number"
            required
            defaultValue={props.entry ? String(props.entry.quantity) : undefined}
          />
          <TextField
            name="entryDate"
            label="Date"
            type="date"
            required
            defaultValue={props.entry?.entryDate ?? new Date().toISOString().split("T")[0]}
          />
          <FormFull>
            <TextField name="remarks" label="Remarks" defaultValue={props.entry?.remarks ?? ""} />
          </FormFull>
        </FormGrid>
      </ActionForm>
      {props.showBackToList !== false ? (
        <p>
          <Link className="text-sm text-sky-400" href="/entries">
            Back to entry list
          </Link>
        </p>
      ) : null}
    </div>
  );
}
