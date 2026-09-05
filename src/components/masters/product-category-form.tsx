"use client";

import { useState } from "react";
import { createProductCategoryAction, updateProductCategoryAction } from "@/lib/masters/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { ActiveCheckbox, TextField } from "@/components/masters/fields";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type OptionDraft = { key: string; code: string; name: string; sortOrder: string; isActive: boolean };

function newOption(index = 0): OptionDraft {
  return {
    key: `opt-${Math.random().toString(36).slice(2, 9)}`,
    code: "",
    name: "",
    sortOrder: String(index),
    isActive: true,
  };
}

export function ProductCategoryForm(props: {
  category?: {
    id: string;
    code: string;
    name: string;
    inputType: "OPEN_TEXT" | "DROPDOWN";
    choiceMode: "SINGLE" | "MULTI" | null;
    isActive: boolean;
    options: { code: string; name: string; sortOrder: number; isActive: boolean }[];
  };
}) {
  const action = props.category
    ? updateProductCategoryAction.bind(null, props.category.id)
    : createProductCategoryAction;
  const [inputType, setInputType] = useState<"OPEN_TEXT" | "DROPDOWN">(props.category?.inputType ?? "OPEN_TEXT");
  const [choiceMode, setChoiceMode] = useState<"SINGLE" | "MULTI">(props.category?.choiceMode ?? "SINGLE");
  const [options, setOptions] = useState<OptionDraft[]>(
    props.category?.options.length
      ? props.category.options.map((option, index) => ({
          key: `opt-${index}`,
          code: option.code,
          name: option.name,
          sortOrder: String(option.sortOrder),
          isActive: option.isActive,
        }))
      : [newOption(0)],
  );

  return (
    <ActionForm action={action} submitLabel={props.category ? "Save category" : "Create category"}>
      <FormGrid>
        <TextField name="code" label="Category code" defaultValue={props.category?.code} required />
        <TextField name="name" label="Category name" defaultValue={props.category?.name} required />
        <div>
          <Label htmlFor="inputType">Input type</Label>
          <select
            id="inputType"
            name="inputType"
            value={inputType}
            onChange={(event) => setInputType(event.target.value as "OPEN_TEXT" | "DROPDOWN")}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="OPEN_TEXT">Open text</option>
            <option value="DROPDOWN">Dropdown</option>
          </select>
        </div>
        {inputType === "DROPDOWN" ? (
          <div>
            <Label htmlFor="choiceMode">Choice mode</Label>
            <select
              id="choiceMode"
              name="choiceMode"
              value={choiceMode}
              onChange={(event) => setChoiceMode(event.target.value as "SINGLE" | "MULTI")}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            >
              <option value="SINGLE">Single choice</option>
              <option value="MULTI">Multi choice</option>
            </select>
          </div>
        ) : null}
        <FormFull>
          <ActiveCheckbox defaultChecked={props.category?.isActive} />
        </FormFull>
        {inputType === "DROPDOWN" ? (
          <FormFull>
            <h2 className="text-sm font-medium text-white">Category options</h2>
            <p className="text-xs text-slate-500">Define the selectable values (e.g. 30MM, PINE, Lipping Patti).</p>
            <div className="mt-3 space-y-2">
              {options.map((option, index) => (
                <div key={option.key} className="grid gap-2 rounded-md border border-slate-700 p-3 sm:grid-cols-4">
                  <input
                    name="optionCode"
                    placeholder="Code"
                    required
                    value={option.code}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((row) => (row.key === option.key ? { ...row, code: event.target.value } : row)),
                      )
                    }
                    className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  />
                  <input
                    name="optionName"
                    placeholder="Name"
                    required
                    value={option.name}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((row) => (row.key === option.key ? { ...row, name: event.target.value } : row)),
                      )
                    }
                    className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  />
                  <input
                    name="optionSortOrder"
                    type="number"
                    value={option.sortOrder}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((row) => (row.key === option.key ? { ...row, sortOrder: event.target.value } : row)),
                      )
                    }
                    className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        name="optionIsActive"
                        value="on"
                        checked={option.isActive}
                        onChange={(event) =>
                          setOptions((current) =>
                            current.map((row) =>
                              row.key === option.key ? { ...row, isActive: event.target.checked } : row,
                            ),
                          )
                        }
                      />
                      Active
                    </label>
                    {/* unchecked checkboxes are omitted from FormData — mirror with hidden */}
                    {!option.isActive ? <input type="hidden" name="optionIsActive" value="off" /> : null}
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={options.length === 1}
                      onClick={() => setOptions((current) => current.filter((row) => row.key !== option.key))}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="sm:col-span-4 text-xs text-slate-500">Option {index + 1}</p>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => setOptions((current) => [...current, newOption(current.length)])}
            >
              Add option
            </Button>
          </FormFull>
        ) : null}
      </FormGrid>
    </ActionForm>
  );
}
