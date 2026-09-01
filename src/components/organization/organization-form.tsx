"use client";

import { useActionState } from "react";
import { updateOrganizationAction } from "@/lib/plants/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrganizationSettings } from "@/lib/organization-settings";

export function OrganizationForm(props: { name: string; settings: OrganizationSettings }) {
  const [state, formAction, pending] = useActionState(updateOrganizationAction, {});

  return (
    <form action={formAction} className="w-full max-w-4xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Label htmlFor="name">Organization name</Label>
          <Input id="name" name="name" defaultValue={props.name} required />
        </div>
        <div>
          <Label htmlFor="startDelayWarningDays">Start delay warning (days)</Label>
          <Input
            id="startDelayWarningDays"
            name="startDelayWarningDays"
            type="number"
            min={0}
            defaultValue={props.settings.startDelayWarningDays}
            required
          />
        </div>
        <div>
          <Label htmlFor="startDelayCriticalDays">Start delay critical (days)</Label>
          <Input
            id="startDelayCriticalDays"
            name="startDelayCriticalDays"
            type="number"
            min={0}
            defaultValue={props.settings.startDelayCriticalDays}
            required
          />
        </div>
        <div>
          <Label htmlFor="gettingDelayedLeadDays">Getting delayed lead (days)</Label>
          <Input
            id="gettingDelayedLeadDays"
            name="gettingDelayedLeadDays"
            type="number"
            min={0}
            defaultValue={props.settings.gettingDelayedLeadDays}
            required
          />
        </div>
      </div>
      {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        Save organization
      </Button>
    </form>
  );
}
