"use client";

import { useMemo, useState } from "react";
import { createProductionEntryAction } from "@/lib/production/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/masters/fields";

export function ProductionEntryForm(props: {
  orders: { id: string; orderNumber: string }[];
  processesByOrder: Record<string, { id: string; label: string }[]>;
  specialActivitiesByOrder: Record<string, { id: string; name: string }[]>;
  defaultOrderId?: string;
}) {
  const [orderId, setOrderId] = useState(props.defaultOrderId ?? props.orders[0]?.id ?? "");
  const processes = useMemo(() => props.processesByOrder[orderId] ?? [], [orderId, props.processesByOrder]);
  const specialActivities = useMemo(
    () => props.specialActivitiesByOrder[orderId] ?? [],
    [orderId, props.specialActivitiesByOrder],
  );

  return (
    <ActionForm action={createProductionEntryAction} submitLabel="Save incremental entry">
      <FormGrid>
        <div>
          <Label htmlFor="productionOrderId">Order</Label>
          <select
            id="productionOrderId"
            name="productionOrderId"
            required
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            {props.orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.orderNumber}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="orderProcessId">Stage</Label>
          <select
            id="orderProcessId"
            name="orderProcessId"
            required
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            {processes.map((process) => (
              <option key={process.id} value={process.id}>
                {process.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Quantity is additional production for this date, not a running total.</p>
        </div>
        <TextField name="entryDate" label="Date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
        <TextField name="quantity" label="Quantity completed" type="number" required />
        <div>
          <Label htmlFor="specialActivityId">Related requested special activity (optional)</Label>
          <select
            id="specialActivityId"
            name="specialActivityId"
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            disabled={specialActivities.length === 0}
          >
            <option value="">None</option>
            {specialActivities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Only activities requested on the order are listed. This does not insert a stage into the main sequence.
          </p>
        </div>
        <FormFull>
          <TextField name="remarks" label="Remarks" />
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
