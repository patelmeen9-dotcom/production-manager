"use client";

import { createSpecialActivityEntryAction } from "@/lib/production/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/masters/fields";

export function SpecialActivityEntryForm(props: {
  orderId: string;
  activities: { id: string; name: string }[];
  processes: { id: string; label: string }[];
}) {
  if (props.activities.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No special activities were requested on this order. Edit is only available when creating an order with special
        activities enabled.
      </p>
    );
  }

  return (
    <ActionForm action={createSpecialActivityEntryAction} submitLabel="Record special activity">
      <input type="hidden" name="productionOrderId" value={props.orderId} />
      <FormGrid>
        <div>
          <Label htmlFor="specialActivityId">Requested activity</Label>
          <select
            id="specialActivityId"
            name="specialActivityId"
            required
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            {props.activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="orderProcessId">Related stage (optional)</Label>
          <select
            id="orderProcessId"
            name="orderProcessId"
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {props.processes.map((process) => (
              <option key={process.id} value={process.id}>
                {process.label}
              </option>
            ))}
          </select>
        </div>
        <TextField name="entryDate" label="Date" type="date" required />
        <TextField name="quantity" label="Quantity" type="number" required />
        <FormFull>
          <TextField name="remarks" label="Remarks" />
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
