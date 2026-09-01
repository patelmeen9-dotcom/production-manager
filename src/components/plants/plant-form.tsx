"use client";

import { useActionState } from "react";
import { createPlantAction, updatePlantAction } from "@/lib/plants/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PlantForm(props: {
  plant?: { id: string; code: string; name: string; location: string | null; isActive: boolean };
}) {
  const action = props.plant ? updatePlantAction.bind(null, props.plant.id) : createPlantAction;
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="w-full max-w-4xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="code">Plant code</Label>
          <Input id="code" name="code" defaultValue={props.plant?.code} required />
        </div>
        <div>
          <Label htmlFor="name">Plant name</Label>
          <Input id="name" name="name" defaultValue={props.plant?.name} required />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={props.plant?.location ?? ""} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" name="isActive" defaultChecked={props.plant?.isActive ?? true} />
            Active
          </label>
        </div>
      </div>
      {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {props.plant ? "Save plant" : "Create plant"}
      </Button>
    </form>
  );
}
