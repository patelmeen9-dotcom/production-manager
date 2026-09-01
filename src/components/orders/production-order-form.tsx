"use client";

import { useState } from "react";
import { createProductionOrderAction } from "@/lib/orders/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/masters/fields";

type Option = { id: string; name: string };

export function ProductionOrderForm(props: {
  clients: Option[];
  plants: Option[];
  products: Option[];
  specialActivities: Option[];
}) {
  const [startDateType, setStartDateType] = useState("NONE");
  const [dueDateType, setDueDateType] = useState("DAYS_FROM_START");
  const [specialRequested, setSpecialRequested] = useState(false);

  return (
    <ActionForm action={createProductionOrderAction} submitLabel="Create order">
      <FormGrid cols={3}>
        <div>
          <Label htmlFor="clientId">Client</Label>
          <select id="clientId" name="clientId" required className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm">
            <option value="">Select client</option>
            {props.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <TextField name="orderNumber" label="Project / order number" required />
        <div>
          <Label htmlFor="plantId">Plant</Label>
          <select id="plantId" name="plantId" required className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm">
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
          <select id="productId" name="productId" required className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm">
            <option value="">Select product</option>
            {props.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
        <TextField name="quantity" label="Quantity" type="number" required />
        <TextField name="orderDate" label="Order date" type="date" required />

        <div>
          <Label htmlFor="startDateType">Production start</Label>
          <select
            id="startDateType"
            name="startDateType"
            value={startDateType}
            onChange={(event) => setStartDateType(event.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="NONE">Start immediately (use order date)</option>
            <option value="FIXED_DATE">Specific start date</option>
            <option value="DAYS_FROM_ORDER">Days from order date</option>
          </select>
        </div>
        {startDateType === "FIXED_DATE" ? <TextField name="startDate" label="Production start date" type="date" required /> : null}
        {startDateType === "DAYS_FROM_ORDER" ? <TextField name="startDays" label="Start after (days)" type="number" required /> : null}

        <div>
          <Label htmlFor="dueDateType">Due date method</Label>
          <select
            id="dueDateType"
            name="dueDateType"
            value={dueDateType}
            onChange={(event) => setDueDateType(event.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="DAYS_FROM_START">Days from production start date</option>
            <option value="FIXED_DATE">Specific due date</option>
            <option value="DAYS_FROM_ORDER">Days from order date</option>
          </select>
        </div>
        {dueDateType === "FIXED_DATE" ? <TextField name="dueDate" label="Due date" type="date" required /> : null}
        {dueDateType === "DAYS_FROM_START" || dueDateType === "DAYS_FROM_ORDER" ? (
          <TextField
            name="dueDays"
            label={dueDateType === "DAYS_FROM_START" ? "Due days from production start" : "Due days from order date"}
            type="number"
            required
          />
        ) : null}

        <div>
          <Label htmlFor="priority">Priority</Label>
          <select id="priority" name="priority" defaultValue="NORMAL" className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm">
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <FormFull>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              name="specialActivitiesRequested"
              checked={specialRequested}
              onChange={(event) => setSpecialRequested(event.target.checked)}
            />
            Special activities requested
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Special activities stay outside the main process sequence. Select one or more from the master list when needed.
          </p>
        </FormFull>

        {specialRequested ? (
          <FormFull>
            <Label>Requested special activities</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {props.specialActivities.map((activity) => (
                <label key={activity.id} className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200">
                  <input type="checkbox" name="specialActivityIds" value={activity.id} />
                  {activity.name}
                </label>
              ))}
            </div>
            {props.specialActivities.length === 0 ? (
              <p className="mt-2 text-sm text-amber-300">No active special activities exist yet. Create them under Special Activities first.</p>
            ) : null}
          </FormFull>
        ) : null}

        <FormFull>
          <TextField name="remarks" label="Remarks" />
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
