"use client";

import { createProductAction, updateProductAction } from "@/lib/masters/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { ActiveCheckbox, TextField } from "@/components/masters/fields";
import { Label } from "@/components/ui/label";

type CategoryOption = { id: string; name: string; code: string };

export function ProductForm(props: {
  product?: {
    id: string;
    name: string;
    code: string;
    details: string | null;
    isActive: boolean;
    categoryIds: string[];
  };
  categories: CategoryOption[];
}) {
  const action = props.product ? updateProductAction.bind(null, props.product.id) : createProductAction;
  const selected = new Set(props.product?.categoryIds ?? []);

  return (
    <ActionForm action={action} submitLabel={props.product ? "Save product" : "Create product"}>
      <FormGrid>
        <TextField name="name" label="Product name" defaultValue={props.product?.name} required />
        <TextField name="code" label="Product code" defaultValue={props.product?.code} required />
        <FormFull>
          <Label htmlFor="details">Details (thickness / specification)</Label>
          <textarea
            id="details"
            name="details"
            rows={3}
            defaultValue={props.product?.details ?? ""}
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            placeholder="Optional — e.g. 35mm, laminated, custom finish notes"
          />
        </FormFull>
        <FormFull>
          <Label>Categories</Label>
          <p className="mt-1 text-xs text-slate-500">A product can belong to multiple categories.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {props.categories.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  defaultChecked={selected.has(category.id)}
                />
                {category.name} ({category.code})
              </label>
            ))}
          </div>
          {props.categories.length === 0 ? (
            <p className="mt-2 text-sm text-amber-300">
              No active product categories yet. Create them under Product Categories first.
            </p>
          ) : null}
        </FormFull>
        <FormFull>
          <ActiveCheckbox defaultChecked={props.product?.isActive} />
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
