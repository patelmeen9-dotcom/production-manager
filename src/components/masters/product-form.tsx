"use client";

import { createProductAction, updateProductAction } from "@/lib/masters/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { ActiveCheckbox, TextField } from "@/components/masters/fields";

export function ProductForm(props: {
  product?: { id: string; name: string; code: string; isActive: boolean };
}) {
  const action = props.product ? updateProductAction.bind(null, props.product.id) : createProductAction;

  return (
    <ActionForm action={action} submitLabel={props.product ? "Save product" : "Create product"}>
      <FormGrid>
        <TextField name="name" label="Product name" defaultValue={props.product?.name} required />
        <TextField name="code" label="Product code" defaultValue={props.product?.code} required />
        <FormFull>
          <ActiveCheckbox defaultChecked={props.product?.isActive} />
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
