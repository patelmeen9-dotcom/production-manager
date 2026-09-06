"use client";

import { useMemo, useState } from "react";
import { createProductionOrderAction } from "@/lib/orders/actions";
import { ActionForm, FormFull, FormGrid } from "@/components/masters/action-form";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/masters/fields";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string; code?: string };
type CategoryOption = { id: string; code: string; name: string; isActive: boolean };
type CategoryDef = {
  id: string;
  name: string;
  code: string;
  inputType: "OPEN_TEXT" | "DROPDOWN";
  choiceMode: "SINGLE" | "MULTI" | null;
  options: CategoryOption[];
};
type ProductOption = Option & {
  categoryIds: string[];
};
type MappingProcess = {
  processId: string;
  processCode: string;
  processName: string;
  sequence: number;
};

type LineProcess = MappingProcess & { expectedDays: string };

type MaterialDraft = {
  key: string;
  name: string;
  quantityPerUnit: string;
  quantityReceived: string;
  processCodes: string[];
};

type LineDraft = {
  key: string;
  productId: string;
  remarks: string;
  /** Quantity per mapped category id. Empty = not on the order. */
  categoryQty: Record<string, string>;
  /** Used when the product has no mapped categories. */
  uncategorizedQty: string;
  processes: LineProcess[];
  materials: MaterialDraft[];
};

function newMaterial(): MaterialDraft {
  return {
    key: `mat-${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    quantityPerUnit: "1",
    quantityReceived: "0",
    processCodes: [],
  };
}

function newLine(): LineDraft {
  return {
    key: `line-${Math.random().toString(36).slice(2, 10)}`,
    productId: "",
    remarks: "",
    categoryQty: {},
    uncategorizedQty: "",
    processes: [],
    materials: [],
  };
}

function parseQty(value: string | undefined): number {
  const qty = Number(value);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

export function ProductionOrderForm(props: {
  clients: Option[];
  plants: Option[];
  products: ProductOption[];
  categories: CategoryDef[];
  specialActivities: Option[];
  /** plantId -> productId -> ordered processes from master mapping */
  mappingsByPlantProduct: Record<string, Record<string, MappingProcess[]>>;
}) {
  const [startDateType, setStartDateType] = useState("NONE");
  const [dueDateType, setDueDateType] = useState("DAYS_FROM_START");
  const [specialRequested, setSpecialRequested] = useState(false);
  const [plantId, setPlantId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);

  const categoriesById = useMemo(
    () => new Map(props.categories.map((category) => [category.id, category])),
    [props.categories],
  );
  const productsById = useMemo(
    () => new Map(props.products.map((product) => [product.id, product])),
    [props.products],
  );

  const matrixColumns = useMemo(() => {
    const map = new Map<string, CategoryDef>();
    for (const line of lines) {
      for (const categoryId of productsById.get(line.productId)?.categoryIds ?? []) {
        const category = categoriesById.get(categoryId);
        if (category) {
          map.set(category.id, category);
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [lines, productsById, categoriesById]);

  function rowTotal(line: LineDraft): number {
    const product = productsById.get(line.productId);
    const categoryIds = product?.categoryIds ?? [];
    if (categoryIds.length === 0) {
      return parseQty(line.uncategorizedQty);
    }
    return categoryIds.reduce((sum, categoryId) => sum + parseQty(line.categoryQty[categoryId]), 0);
  }

  const totalQuantity = lines.reduce((sum, line) => sum + rowTotal(line), 0);

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function applyProductMapping(lineKey: string, productId: string, nextPlantId = plantId) {
    const mapping = nextPlantId && productId ? (props.mappingsByPlantProduct[nextPlantId]?.[productId] ?? []) : [];
    updateLine(lineKey, {
      productId,
      processes: mapping.map((row) => ({ ...row, expectedDays: "" })),
      categoryQty: {},
      uncategorizedQty: "",
      materials: [],
    });
  }

  const linesJson = JSON.stringify(
    lines.flatMap((line) => {
      const product = productsById.get(line.productId);
      const categoryIds = product?.categoryIds ?? [];
      const cells =
        categoryIds.length === 0
          ? parseQty(line.uncategorizedQty) > 0
            ? [{ categoryId: null as string | null, quantity: parseQty(line.uncategorizedQty) }]
            : []
          : categoryIds
              .map((categoryId) => ({ categoryId, quantity: parseQty(line.categoryQty[categoryId]) }))
              .filter((cell) => cell.quantity > 0);
      return cells.map((cell) => ({
        productId: line.productId,
        quantity: cell.quantity,
        remarks: line.remarks,
        categorySelections: cell.categoryId
          ? [{ productCategoryId: cell.categoryId, textValue: "", optionIds: [] }]
          : [],
        processes: line.processes.map((process, index) => ({
          processId: process.processId,
          processCode: process.processCode,
          processName: process.processName,
          sequence: index + 1,
          expectedDays: process.expectedDays,
        })),
        materials: line.materials
          .filter((material) => material.name.trim())
          .map((material) => ({
            name: material.name,
            quantityPerUnit: material.quantityPerUnit,
            quantityReceived: material.quantityReceived,
            processCodes: material.processCodes,
          })),
      }));
    }),
  );

  return (
    <ActionForm action={createProductionOrderAction} submitLabel="Create order">
      <input type="hidden" name="linesJson" value={linesJson} />
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
          <select
            id="plantId"
            name="plantId"
            required
            value={plantId}
            onChange={(event) => {
              const next = event.target.value;
              setPlantId(next);
              setLines((current) =>
                current.map((line) => ({
                  ...line,
                  processes:
                    line.productId && next
                      ? (props.mappingsByPlantProduct[next]?.[line.productId] ?? []).map((row) => ({
                          ...row,
                          expectedDays: "",
                        }))
                      : [],
                  materials: [],
                })),
              );
            }}
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-white">Order lines</h2>
              <p className="text-xs text-slate-500">
                Rows are products. Columns are mapped categories. Enter quantity per product + category, or leave blank
                for -. Total is calculated. Processes and materials stay per product.
              </p>
            </div>
            <p className="text-sm text-slate-300">Total order qty: {totalQuantity || "—"}</p>
          </div>

          <div className="mt-3 overflow-x-auto rounded-md border border-slate-700">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-900/80 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  {matrixColumns.map((category) => (
                    <th key={category.id} className="px-3 py-2 text-right">
                      {category.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const mappedIds = new Set(productsById.get(line.productId)?.categoryIds ?? []);
                  const hasCategories = mappedIds.size > 0;
                  return (
                    <tr key={line.key} className="border-b border-slate-800">
                      <td className="px-3 py-2">
                        <select
                          required
                          value={line.productId}
                          onChange={(event) => applyProductMapping(line.key, event.target.value)}
                          className="w-full min-w-[160px] rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
                        >
                          <option value="">Select product</option>
                          {props.products.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      {matrixColumns.map((category) => {
                        const applicable = mappedIds.has(category.id);
                        return (
                          <td key={category.id} className="px-3 py-2 text-right">
                            {applicable ? (
                              <input
                                type="number"
                                min={1}
                                value={line.categoryQty[category.id] ?? ""}
                                onChange={(event) =>
                                  updateLine(line.key, {
                                    categoryQty: { ...line.categoryQty, [category.id]: event.target.value },
                                  })
                                }
                                className="ml-auto w-20 rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-right text-sm"
                                placeholder="-"
                              />
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-mono text-slate-200">
                        {hasCategories ? (
                          rowTotal(line) || "-"
                        ) : (
                          <input
                            type="number"
                            min={1}
                            required={!hasCategories && Boolean(line.productId)}
                            value={line.uncategorizedQty}
                            onChange={(event) => updateLine(line.key, { uncategorizedQty: event.target.value })}
                            className="ml-auto w-20 rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-right text-sm"
                            placeholder="qty"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={lines.length === 1}
                          onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900/80">
                  <td className="px-3 py-2 text-xs font-semibold text-slate-200">Total order quantity</td>
                  {matrixColumns.map((category) => (
                    <td key={category.id} />
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-semibold text-white">{totalQuantity || "—"}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => setLines((current) => [...current, newLine()])}>
            Add product
          </Button>

          <div className="mt-4 space-y-4">
            {lines.map((line) => {
              const lineQty = rowTotal(line);
              const product = productsById.get(line.productId);
              if (!line.productId) {
                return null;
              }
              return (
                <div key={`${line.key}-details`} className="space-y-3 rounded-md border border-slate-700 p-3">
                  <p className="text-sm font-medium text-white">
                    {product?.name ?? "Product"} · qty {lineQty || "—"}
                  </p>
                  <div>
                    <Label>Line remarks (optional)</Label>
                    <textarea
                      rows={2}
                      value={line.remarks}
                      onChange={(event) => updateLine(line.key, { remarks: event.target.value })}
                      className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-300">Process stages (inherited — editable)</p>
                    <p className="text-xs text-slate-500">
                      Expected days per stage (optional) override the process master units/day plan for timing.
                    </p>
                    {line.processes.length === 0 ? (
                      <p className="mt-1 text-xs text-amber-300">
                        {plantId && line.productId
                          ? "No plant/product mapping found. Create a mapping first."
                          : "Select plant and product to load processes."}
                      </p>
                    ) : (
                      <ol className="mt-2 space-y-2">
                        {line.processes.map((process, processIndex) => (
                          <li
                            key={`${process.processId}-${processIndex}`}
                            className="grid gap-2 rounded border border-slate-800 p-2 sm:grid-cols-[1fr_120px_auto] sm:items-end text-sm text-slate-200"
                          >
                            <span className="sm:self-center">
                              {processIndex + 1}. {process.processName} ({process.processCode})
                            </span>
                            <div>
                              <Label className="text-xs text-slate-400">Expected days</Label>
                              <input
                                type="number"
                                min={1}
                                value={process.expectedDays}
                                onChange={(event) => {
                                  const next = line.processes.map((row, index) =>
                                    index === processIndex ? { ...row, expectedDays: event.target.value } : row,
                                  );
                                  updateLine(line.key, { processes: next });
                                }}
                                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm"
                                placeholder="optional"
                              />
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={processIndex === 0}
                                onClick={() => {
                                  const next = [...line.processes];
                                  const tmp = next[processIndex - 1]!;
                                  next[processIndex - 1] = next[processIndex]!;
                                  next[processIndex] = tmp;
                                  updateLine(line.key, { processes: next });
                                }}
                              >
                                Up
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={processIndex === line.processes.length - 1}
                                onClick={() => {
                                  const next = [...line.processes];
                                  const tmp = next[processIndex + 1]!;
                                  next[processIndex + 1] = next[processIndex]!;
                                  next[processIndex] = tmp;
                                  updateLine(line.key, { processes: next });
                                }}
                              >
                                Down
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={line.processes.length === 1}
                                onClick={() => {
                                  const removed = line.processes[processIndex]!;
                                  updateLine(line.key, {
                                    processes: line.processes.filter((_, i) => i !== processIndex),
                                    materials: line.materials.map((material) => ({
                                      ...material,
                                      processCodes: material.processCodes.filter((code) => code !== removed.processCode),
                                    })),
                                  });
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                    {plantId && line.productId ? (
                      <div className="mt-2">
                        <Label>Add process from mapping</Label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                          value=""
                          onChange={(event) => {
                            const code = event.target.value;
                            const source = props.mappingsByPlantProduct[plantId]?.[line.productId] ?? [];
                            const row = source.find((item) => item.processCode === code);
                            if (!row) return;
                            if (line.processes.some((process) => process.processCode === code)) return;
                            updateLine(line.key, {
                              processes: [...line.processes, { ...row, expectedDays: "" }],
                            });
                          }}
                        >
                          <option value="">Select process to add</option>
                          {(props.mappingsByPlantProduct[plantId]?.[line.productId] ?? [])
                            .filter((row) => !line.processes.some((process) => process.processCode === row.processCode))
                            .map((row) => (
                              <option key={row.processCode} value={row.processCode}>
                                {row.processName}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-300">Materials (optional, per line)</p>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => updateLine(line.key, { materials: [...line.materials, newMaterial()] })}
                      >
                        Add material
                      </Button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {line.materials.map((material) => {
                        const perUnit = Number(material.quantityPerUnit);
                        const totalNeeded =
                          Number.isFinite(perUnit) && Number.isFinite(lineQty) && lineQty > 0 ? perUnit * lineQty : null;
                        return (
                          <div key={material.key} className="grid gap-2 rounded border border-slate-800 p-2 sm:grid-cols-2">
                            <div>
                              <Label>Material name</Label>
                              <input
                                value={material.name}
                                onChange={(event) =>
                                  updateLine(line.key, {
                                    materials: line.materials.map((row) =>
                                      row.key === material.key ? { ...row, name: event.target.value } : row,
                                    ),
                                  })
                                }
                                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                                placeholder="e.g. Lamination"
                              />
                            </div>
                            <div>
                              <Label>Qty per 1 product unit</Label>
                              <input
                                type="number"
                                min={1}
                                value={material.quantityPerUnit}
                                onChange={(event) =>
                                  updateLine(line.key, {
                                    materials: line.materials.map((row) =>
                                      row.key === material.key ? { ...row, quantityPerUnit: event.target.value } : row,
                                    ),
                                  })
                                }
                                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                              />
                              <p className="mt-1 text-xs text-slate-500">
                                Total needed for line: {totalNeeded ?? "—"}
                              </p>
                            </div>
                            <div>
                              <Label>Qty received</Label>
                              <input
                                type="number"
                                min={0}
                                value={material.quantityReceived}
                                onChange={(event) =>
                                  updateLine(line.key, {
                                    materials: line.materials.map((row) =>
                                      row.key === material.key ? { ...row, quantityReceived: event.target.value } : row,
                                    ),
                                  })
                                }
                                className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <Label>Used in stages</Label>
                              <div className="mt-1 max-h-28 space-y-1 overflow-auto rounded border border-slate-700 p-2">
                                {line.processes.map((process) => (
                                  <label key={process.processCode} className="flex items-center gap-2 text-sm text-slate-200">
                                    <input
                                      type="checkbox"
                                      checked={material.processCodes.includes(process.processCode)}
                                      onChange={(event) => {
                                        const next = new Set(material.processCodes);
                                        if (event.target.checked) next.add(process.processCode);
                                        else next.delete(process.processCode);
                                        updateLine(line.key, {
                                          materials: line.materials.map((row) =>
                                            row.key === material.key ? { ...row, processCodes: [...next] } : row,
                                          ),
                                        });
                                      }}
                                    />
                                    {process.processName}
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="sm:col-span-2">
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() =>
                                  updateLine(line.key, {
                                    materials: line.materials.filter((row) => row.key !== material.key),
                                  })
                                }
                              >
                                Remove material
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </FormFull>

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
          </FormFull>
        ) : null}
        <FormFull>
          <TextField name="remarks" label="Order remarks" />
        </FormFull>
        <FormFull>
          <div className="space-y-2">
            <div>
              <Label htmlFor="attachment">Attachment (optional)</Label>
              <p className="text-xs text-slate-500">Attach an XLSX or PDF file — max 20 MB</p>
            </div>
            <input
              id="attachment"
              type="file"
              name="attachment"
              accept=".xlsx,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
              className="block w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-200
                file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:font-medium
                file:text-slate-200 hover:file:bg-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </FormFull>
      </FormGrid>
    </ActionForm>
  );
}
