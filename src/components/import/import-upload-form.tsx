"use client";

import { useActionState } from "react";
import { uploadImportAction, type ImportFormState } from "@/lib/import/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initial: ImportFormState = {};

export function ImportUploadForm() {
  const [state, formAction, pending] = useActionState(uploadImportAction, initial);

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <div>
        <Label htmlFor="file">Excel workbook (.xlsx)</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="mt-1 block w-full text-sm text-slate-300"
        />
      </div>
      <div>
        <Label htmlFor="duplicateStrategy">Duplicate handling</Label>
        <select
          id="duplicateStrategy"
          name="duplicateStrategy"
          defaultValue="CREATE_OR_UPDATE"
          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
        >
          <option value="CREATE_OR_UPDATE">Create new or update existing masters/projects</option>
          <option value="SKIP_EXISTING">Skip existing reference codes</option>
          <option value="FAIL_ON_DUPLICATE">Fail on duplicate reference codes</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Production entries are always created as new incremental transactions and are never silently overwritten.
        </p>
      </div>
      {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Validating…" : "Upload and validate"}
      </Button>
    </form>
  );
}
