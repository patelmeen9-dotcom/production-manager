"use client";

import { useState } from "react";
import { saveProcessMappingAction } from "@/lib/masters/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string; code?: string };

export function ProcessMappingForm(props: {
  plants: Option[];
  products: Option[];
  processes: Option[];
  defaultPlantId?: string;
  defaultProductId?: string;
  defaultProcessIds?: string[];
}) {
  const initial = props.defaultProcessIds && props.defaultProcessIds.length > 0 ? props.defaultProcessIds : [""];
  const [rows, setRows] = useState<string[]>(initial);

  return (
    <ActionForm action={saveProcessMappingAction} submitLabel="Save mapping">
      <FormGrid>
        <div>
          <Label htmlFor="plantId">Plant</Label>
          <select
            id="plantId"
            name="plantId"
            defaultValue={props.defaultPlantId}
            required
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">Select plant</option>
            {props.plants.map((plant) => (
              <option key={plant.id} value={plant.id}>
                {plant.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="productId">Product</Label>
          <select
            id="productId"
            name="productId"
            defaultValue={props.defaultProductId}
            required
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">Select product</option>
            {props.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.code})
              </option>
            ))}
          </select>
        </div>
        <FormFull>
          <p className="text-sm font-medium text-slate-200">Process sequence</p>
          <p className="text-xs text-slate-500">Order defines the production flow for this plant and product. Stage names are master data.</p>
          <div className="mt-2 space-y-2">
            {rows.map((processId, index) => (
              <div key={`${index}-${processId || "empty"}`} className="flex gap-2">
                <span className="w-8 pt-2 text-sm text-slate-400">{index + 1}.</span>
                <select
                  name="processIds"
                  value={processId}
                  onChange={(event) => {
                    const next = [...rows];
                    next[index] = event.target.value;
                    setRows(next);
                  }}
                  required
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                >
                  <option value="">Select process</option>
                  {props.processes.map((process) => (
                    <option key={process.id} value={process.id}>
                      {process.name} ({process.code})
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setRows([...rows, ""])}>
              Add stage
            </Button>
            {rows.length > 1 ? (
              <Button type="button" variant="ghost" onClick={() => setRows(rows.slice(0, -1))}>
                Remove last
              </Button>
            ) : null}
          </div>
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
