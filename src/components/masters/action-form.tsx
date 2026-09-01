"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/masters/actions";
import { Button } from "@/components/ui/button";

export function ActionForm(props: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(props.action, {});

  return (
    <form action={formAction} className="w-full max-w-4xl space-y-4">
      {props.children}
      {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-300">{state.success}</p> : null}
      <Button type="submit" disabled={pending}>
        {props.submitLabel}
      </Button>
    </form>
  );
}

/** Responsive multi-column field layout; collapses on narrow screens. */
export function FormGrid(props: { children: React.ReactNode; cols?: 2 | 3 }) {
  const cols = props.cols === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";
  return <div className={`grid gap-4 ${cols}`}>{props.children}</div>;
}

/** Span the full form width inside a FormGrid. */
export function FormFull(props: { children: React.ReactNode }) {
  return <div className="sm:col-span-2 lg:col-span-3">{props.children}</div>;
}
