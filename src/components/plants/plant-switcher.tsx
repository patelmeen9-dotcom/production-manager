"use client";

import { switchPlantAction } from "@/lib/plants/actions";
import { ALL_PLANTS } from "@/lib/plants/scope";

export function PlantSwitcher(props: {
  plants: { id: string; name: string }[];
  selected: string;
  canUseAllPlants: boolean;
}) {
  if (props.plants.length === 0) {
    return <p className="text-xs text-ink-faint">No plants yet</p>;
  }

  return (
    <form action={switchPlantAction} className="flex items-center gap-2">
      <label htmlFor="plantId" className="text-xs text-ink-soft">
        Current plant
      </label>
      <select
        id="plantId"
        name="plantId"
        defaultValue={props.selected}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-line-strong bg-input px-2 py-1 text-sm text-ink"
      >
        {props.canUseAllPlants ? <option value={ALL_PLANTS}>All Plants</option> : null}
        {props.plants.map((plant) => (
          <option key={plant.id} value={plant.id}>
            {plant.name}
          </option>
        ))}
      </select>
    </form>
  );
}
