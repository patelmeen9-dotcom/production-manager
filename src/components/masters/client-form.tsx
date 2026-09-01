"use client";

import { createClientAction, updateClientAction } from "@/lib/masters/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { ActiveCheckbox, TextField } from "@/components/masters/fields";

export function ClientForm(props: {
  client?: {
    id: string;
    code: string;
    name: string;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    isActive: boolean;
  };
}) {
  const action = props.client ? updateClientAction.bind(null, props.client.id) : createClientAction;

  return (
    <ActionForm action={action} submitLabel={props.client ? "Save client" : "Create client"}>
      <FormGrid>
        <TextField name="code" label="Client code" defaultValue={props.client?.code} required />
        <TextField name="name" label="Client name" defaultValue={props.client?.name} required />
        <TextField name="contactName" label="Contact name" defaultValue={props.client?.contactName ?? ""} />
        <TextField name="contactEmail" label="Contact email" type="email" defaultValue={props.client?.contactEmail ?? ""} />
        <TextField name="contactPhone" label="Contact phone" defaultValue={props.client?.contactPhone ?? ""} />
        <FormFull>
          <ActiveCheckbox defaultChecked={props.client?.isActive} />
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
