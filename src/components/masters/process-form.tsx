"use client";

import { createProcessAction, updateProcessAction } from "@/lib/masters/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { ActiveCheckbox, TextField } from "@/components/masters/fields";
import { Label } from "@/components/ui/label";

export function ProcessForm(props: {
  process?: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    unitsPerDay: number | null;
    isActive: boolean;
  };
}) {
  const action = props.process ? updateProcessAction.bind(null, props.process.id) : createProcessAction;

  return (
    <ActionForm action={action} submitLabel={props.process ? "Save process" : "Create process"}>
      <FormGrid>
        <TextField name="name" label="Process name" defaultValue={props.process?.name} required />
        <TextField name="code" label="Process code" defaultValue={props.process?.code} required />
        <TextField
          name="unitsPerDay"
          label="Units per day"
          type="number"
          defaultValue={props.process?.unitsPerDay != null ? String(props.process.unitsPerDay) : ""}
        />
        <FormFull>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            defaultValue={props.process?.description ?? ""}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            rows={3}
          />
        </FormFull>
        <FormFull>
          <p className="text-xs text-slate-500">
            Units per day is the planned daily throughput for this stage. Orders use it (with optional expected days
            on the order) to judge on-time / getting delayed / delayed.
          </p>
        </FormFull>
        <FormFull>
          <ActiveCheckbox defaultChecked={props.process?.isActive} />
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
