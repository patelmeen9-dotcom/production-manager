"use client";

import { createSpecialActivityAction, updateSpecialActivityAction } from "@/lib/masters/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { ActiveCheckbox, TextField } from "@/components/masters/fields";
import { Label } from "@/components/ui/label";
import type { SpecialActivityType } from "@prisma/client";

export function SpecialActivityForm(props: {
  activity?: { id: string; name: string; code: string; activityType: SpecialActivityType; isActive: boolean };
}) {
  const action = props.activity
    ? updateSpecialActivityAction.bind(null, props.activity.id)
    : createSpecialActivityAction;

  return (
    <ActionForm action={action} submitLabel={props.activity ? "Save activity" : "Create activity"}>
      <FormGrid>
        <TextField name="name" label="Activity name" defaultValue={props.activity?.name} required />
        <TextField name="code" label="Activity code" defaultValue={props.activity?.code} required />
        <div>
          <Label htmlFor="activityType">Activity type</Label>
          <select
            id="activityType"
            name="activityType"
            defaultValue={props.activity?.activityType ?? "SPECIAL_PROCESS"}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="SPECIAL_PROCESS">Special process</option>
            <option value="REWORK">Rework</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <FormFull>
          <ActiveCheckbox defaultChecked={props.activity?.isActive} />
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
