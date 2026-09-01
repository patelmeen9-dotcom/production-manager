"use client";

import { useActionState } from "react";
import { updateUserPlantAccessAction } from "@/lib/plants/actions";
import { Button } from "@/components/ui/button";

export function UserPlantAccessForm(props: {
  userId: string;
  userName: string;
  plants: { id: string; name: string }[];
  grantedPlantIds: string[];
}) {
  const [state, formAction, pending] = useActionState(updateUserPlantAccessAction, {});

  return (
    <form action={formAction} className="rounded-lg border border-slate-800 p-4">
      <input type="hidden" name="userId" value={props.userId} />
      <p className="font-medium text-white">{props.userName}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {props.plants.map((plant) => (
          <label key={plant.id} className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              name="plantIds"
              value={plant.id}
              defaultChecked={props.grantedPlantIds.includes(plant.id)}
            />
            {plant.name}
          </label>
        ))}
      </div>
      {state.error ? <p className="mt-2 text-sm text-red-300">{state.error}</p> : null}
      <Button type="submit" className="mt-3" disabled={pending}>
        Save access
      </Button>
    </form>
  );
}
