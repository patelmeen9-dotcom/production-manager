import { parseDateOnly, resolveDueDate, resolveEffectiveStartDate } from "@/lib/orders/date-rules";
import { assertValidProductionEntry } from "@/lib/production/validate";
import { normalizeCode, parseOptionalBool, parsePipeList } from "@/lib/import/parse";
import type {
  ClientImportRow,
  DuplicateStrategy,
  ImportIssue,
  ImportPreviewPayload,
  MappingImportRow,
  ParsedWorkbook,
  PlantImportRow,
  ProcessImportRow,
  ProductImportRow,
  ProductionEntryImportRow,
  ProjectImportRow,
  SheetSummary,
  SpecialActivityEntryImportRow,
  SpecialActivityImportRow,
} from "@/lib/import/types";

export type OrgCatalog = {
  plants: { id: string; code: string; name: string }[];
  clients: { id: string; code: string; name: string }[];
  products: { id: string; code: string; name: string }[];
  processes: { id: string; code: string; name: string }[];
  specialActivities: { id: string; code: string; name: string }[];
  mappings: { plantCode: string; productCode: string; processCodes: string[] }[];
  orders: {
    id: string;
    orderNumber: string;
    plantCode: string;
    quantity: number;
    lifecycleStatus: string;
    processes: { id: string; processCode: string; sequence: number; processName: string; plannedQuantity: number }[];
    entries: { orderProcessId: string; quantity: number }[];
  }[];
  grantedPlantCodes: Set<string> | null;
};

function issue(
  sheet: string,
  row: number,
  column: string,
  value: string,
  error: string,
  suggestion?: string,
  level: "error" | "warning" = "error",
): ImportIssue {
  return { sheet, row, column, value, error, suggestion, level };
}

function rowNum(record: Record<string, string>): number {
  return Number(record.__row ?? 0) || 0;
}

function decideAction(
  exists: boolean,
  strategy: DuplicateStrategy,
  sheet: string,
  row: number,
  column: string,
  value: string,
  issues: ImportIssue[],
): "create" | "update" | "skip" | "fail" {
  if (!exists) {
    return "create";
  }
  if (strategy === "CREATE_OR_UPDATE") {
    return "update";
  }
  if (strategy === "SKIP_EXISTING") {
    issues.push(issue(sheet, row, column, value, "Existing record will be skipped.", "Change strategy to CREATE_OR_UPDATE to update.", "warning"));
    return "skip";
  }
  issues.push(issue(sheet, row, column, value, "Duplicate reference code.", "Use CREATE_OR_UPDATE or SKIP_EXISTING, or change the code."));
  return "fail";
}

function emptyToNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export function validateImportWorkbook(
  workbook: ParsedWorkbook,
  catalog: OrgCatalog,
  strategy: DuplicateStrategy,
): { payload: ImportPreviewPayload; issues: ImportIssue[]; summaries: SheetSummary[] } {
  const issues: ImportIssue[] = [];
  const plantByCode = new Map(catalog.plants.map((row) => [normalizeCode(row.code), row]));
  const clientByCode = new Map(catalog.clients.map((row) => [normalizeCode(row.code), row]));
  const productByCode = new Map(catalog.products.map((row) => [normalizeCode(row.code), row]));
  const processByCode = new Map(catalog.processes.map((row) => [normalizeCode(row.code), row]));
  const activityByCode = new Map(catalog.specialActivities.map((row) => [normalizeCode(row.code), row]));
  const orderByNumber = new Map(catalog.orders.map((row) => [normalizeCode(row.orderNumber), row]));

  const plants: PlantImportRow[] = [];
  const plantCodesInFile = new Set<string>();
  for (const record of workbook.plants) {
    const row = rowNum(record);
    const code = normalizeCode(record.PlantCode ?? "");
    const name = (record.PlantName ?? "").trim();
    if (!code) {
      issues.push(issue("Plants", row, "PlantCode", "", "PlantCode is required."));
      continue;
    }
    if (!name) {
      issues.push(issue("Plants", row, "PlantName", "", "PlantName is required."));
      continue;
    }
    if (plantCodesInFile.has(code)) {
      issues.push(issue("Plants", row, "PlantCode", code, "Duplicate PlantCode in the workbook."));
      continue;
    }
    plantCodesInFile.add(code);
    if (catalog.grantedPlantCodes && !catalog.grantedPlantCodes.has(code) && !plantByCode.has(code)) {
      // Creating a new plant is allowed for managers with org access; plant grant check applies when referencing plants.
    }
    const action = decideAction(plantByCode.has(code), strategy, "Plants", row, "PlantCode", code, issues);
    if (action === "fail") {
      continue;
    }
    plants.push({
      sheetRow: row,
      action,
      code,
      name,
      location: emptyToNull(record.Location ?? ""),
      isActive: parseOptionalBool(record.IsActive ?? ""),
    });
  }

  const clients: ClientImportRow[] = [];
  const clientCodesInFile = new Set<string>();
  for (const record of workbook.clients) {
    const row = rowNum(record);
    const code = normalizeCode(record.ClientCode ?? "");
    const name = (record.ClientName ?? "").trim();
    if (!code || !name) {
      issues.push(issue("Clients", row, !code ? "ClientCode" : "ClientName", code || name, "ClientCode and ClientName are required."));
      continue;
    }
    if (clientCodesInFile.has(code)) {
      issues.push(issue("Clients", row, "ClientCode", code, "Duplicate ClientCode in the workbook."));
      continue;
    }
    clientCodesInFile.add(code);
    const action = decideAction(clientByCode.has(code), strategy, "Clients", row, "ClientCode", code, issues);
    if (action === "fail") {
      continue;
    }
    clients.push({
      sheetRow: row,
      action,
      code,
      name,
      contactName: emptyToNull(record.ContactName ?? ""),
      contactEmail: emptyToNull(record.ContactEmail ?? ""),
      contactPhone: emptyToNull(record.ContactPhone ?? ""),
      isActive: parseOptionalBool(record.IsActive ?? ""),
    });
  }

  const products: ProductImportRow[] = [];
  const productCodesInFile = new Set<string>();
  for (const record of workbook.products) {
    const row = rowNum(record);
    const code = normalizeCode(record.ProductCode ?? "");
    const name = (record.ProductName ?? "").trim();
    if (!code || !name) {
      issues.push(issue("Products", row, !code ? "ProductCode" : "ProductName", code || name, "ProductCode and ProductName are required."));
      continue;
    }
    if (productCodesInFile.has(code)) {
      issues.push(issue("Products", row, "ProductCode", code, "Duplicate ProductCode in the workbook."));
      continue;
    }
    productCodesInFile.add(code);
    const action = decideAction(productByCode.has(code), strategy, "Products", row, "ProductCode", code, issues);
    if (action === "fail") {
      continue;
    }
    products.push({ sheetRow: row, action, code, name, isActive: parseOptionalBool(record.IsActive ?? "") });
  }

  const processes: ProcessImportRow[] = [];
  const processCodesInFile = new Set<string>();
  for (const record of workbook.processes) {
    const row = rowNum(record);
    const code = normalizeCode(record.ProcessCode ?? "");
    const name = (record.ProcessName ?? "").trim();
    if (!code || !name) {
      issues.push(issue("Processes", row, !code ? "ProcessCode" : "ProcessName", code || name, "ProcessCode and ProcessName are required."));
      continue;
    }
    if (processCodesInFile.has(code)) {
      issues.push(issue("Processes", row, "ProcessCode", code, "Duplicate ProcessCode in the workbook."));
      continue;
    }
    processCodesInFile.add(code);
    const action = decideAction(processByCode.has(code), strategy, "Processes", row, "ProcessCode", code, issues);
    if (action === "fail") {
      continue;
    }
    processes.push({
      sheetRow: row,
      action,
      code,
      name,
      description: emptyToNull(record.Description ?? ""),
      isActive: parseOptionalBool(record.IsActive ?? ""),
    });
  }

  const knownPlant = (code: string) => plantByCode.has(code) || plantCodesInFile.has(code);
  const knownClient = (code: string) => clientByCode.has(code) || clientCodesInFile.has(code);
  const knownProduct = (code: string) => productByCode.has(code) || productCodesInFile.has(code);
  const knownProcess = (code: string) => processByCode.has(code) || processCodesInFile.has(code);

  const mappings: MappingImportRow[] = [];
  const mappingKeys = new Set<string>();
  const existingMappingKeys = new Set(catalog.mappings.map((row) => `${normalizeCode(row.plantCode)}:${normalizeCode(row.productCode)}`));
  for (const record of workbook.mappings) {
    const row = rowNum(record);
    const plantCode = normalizeCode(record.PlantCode ?? "");
    const productCode = normalizeCode(record.ProductCode ?? "");
    const processCodes = parsePipeList(record.ProcessCodes ?? "");
    if (!plantCode || !productCode || processCodes.length === 0) {
      issues.push(issue("ProcessMappings", row, "ProcessCodes", record.ProcessCodes ?? "", "PlantCode, ProductCode, and ProcessCodes are required."));
      continue;
    }
    if (catalog.grantedPlantCodes && !catalog.grantedPlantCodes.has(plantCode)) {
      issues.push(issue("ProcessMappings", row, "PlantCode", plantCode, "You do not have access to this plant."));
      continue;
    }
    if (!knownPlant(plantCode)) {
      issues.push(issue("ProcessMappings", row, "PlantCode", plantCode, "PlantCode does not exist.", "Add the plant on the Plants sheet first."));
      continue;
    }
    if (!knownProduct(productCode)) {
      issues.push(issue("ProcessMappings", row, "ProductCode", productCode, "ProductCode does not exist."));
      continue;
    }
    let invalidProcess = false;
    for (const processCode of processCodes) {
      if (!knownProcess(processCode)) {
        issues.push(issue("ProcessMappings", row, "ProcessCodes", processCode, `ProcessCode: ${processCode} does not exist.`));
        invalidProcess = true;
      }
    }
    if (invalidProcess) {
      continue;
    }
    const key = `${plantCode}:${productCode}`;
    if (mappingKeys.has(key)) {
      issues.push(issue("ProcessMappings", row, "PlantCode", key, "Duplicate plant/product mapping in the workbook."));
      continue;
    }
    mappingKeys.add(key);
    const action = decideAction(existingMappingKeys.has(key), strategy, "ProcessMappings", row, "PlantCode", key, issues);
    if (action === "fail") {
      continue;
    }
    mappings.push({ sheetRow: row, action, plantCode, productCode, processCodes });
  }

  const specialActivities: SpecialActivityImportRow[] = [];
  const activityCodesInFile = new Set<string>();
  for (const record of workbook.specialActivities) {
    const row = rowNum(record);
    const code = normalizeCode(record.ActivityCode ?? "");
    const name = (record.ActivityName ?? "").trim();
    const activityType = (record.ActivityType ?? "").trim().toUpperCase();
    if (!code || !name) {
      issues.push(issue("SpecialActivities", row, "ActivityCode", code, "ActivityCode and ActivityName are required."));
      continue;
    }
    if (!["SPECIAL_PROCESS", "REWORK", "OTHER"].includes(activityType)) {
      issues.push(issue("SpecialActivities", row, "ActivityType", activityType, "ActivityType must be SPECIAL_PROCESS, REWORK, or OTHER."));
      continue;
    }
    if (activityCodesInFile.has(code)) {
      issues.push(issue("SpecialActivities", row, "ActivityCode", code, "Duplicate ActivityCode in the workbook."));
      continue;
    }
    activityCodesInFile.add(code);
    const action = decideAction(activityByCode.has(code), strategy, "SpecialActivities", row, "ActivityCode", code, issues);
    if (action === "fail") {
      continue;
    }
    specialActivities.push({
      sheetRow: row,
      action,
      code,
      name,
      activityType: activityType as SpecialActivityImportRow["activityType"],
      isActive: parseOptionalBool(record.IsActive ?? ""),
    });
  }

  const projects: ProjectImportRow[] = [];
  const projectCodesInFile = new Set<string>();
  const plannedSnapshots = new Map<string, string[]>();

  for (const record of workbook.projects) {
    const row = rowNum(record);
    const projectCode = normalizeCode(record.ProjectCode ?? "");
    const clientCode = normalizeCode(record.ClientCode ?? "");
    const plantCode = normalizeCode(record.PlantCode ?? "");
    const productCode = normalizeCode(record.ProductCode ?? "");
    const quantity = Number(record.Quantity ?? "");
    const orderDate = (record.OrderDate ?? "").trim();
    const startDateType = ((record.StartDateType ?? "NONE").trim().toUpperCase() || "NONE") as ProjectImportRow["startDateType"];
    const dueDateType = (record.DueDateType ?? "").trim().toUpperCase() as ProjectImportRow["dueDateType"];
    const processCodes = parsePipeList(record.ProcessCodes ?? "");
    const existing = orderByNumber.get(projectCode);

    if (!projectCode || !clientCode || !plantCode || !productCode || !orderDate || !dueDateType) {
      issues.push(issue("Projects", row, "ProjectCode", projectCode, "ProjectCode, ClientCode, PlantCode, ProductCode, OrderDate, and DueDateType are required."));
      continue;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      issues.push(issue("Projects", row, "Quantity", String(record.Quantity ?? ""), "Quantity must be a positive integer."));
      continue;
    }
    if (catalog.grantedPlantCodes && !catalog.grantedPlantCodes.has(plantCode)) {
      issues.push(issue("Projects", row, "PlantCode", plantCode, "You do not have access to this plant."));
      continue;
    }
    if (!knownClient(clientCode)) {
      issues.push(issue("Projects", row, "ClientCode", clientCode, "ClientCode does not exist."));
      continue;
    }
    if (!knownPlant(plantCode)) {
      issues.push(issue("Projects", row, "PlantCode", plantCode, "PlantCode does not exist."));
      continue;
    }
    if (!knownProduct(productCode)) {
      issues.push(issue("Projects", row, "ProductCode", productCode, "ProductCode does not exist."));
      continue;
    }
    if (!["NONE", "FIXED_DATE", "DAYS_FROM_ORDER"].includes(startDateType)) {
      issues.push(issue("Projects", row, "StartDateType", startDateType, "Invalid StartDateType."));
      continue;
    }
    if (!["FIXED_DATE", "DAYS_FROM_ORDER", "DAYS_FROM_START"].includes(dueDateType)) {
      issues.push(
        issue(
          "Projects",
          row,
          "DueDateType",
          dueDateType,
          "DueDateType must be FIXED_DATE, DAYS_FROM_ORDER, or DAYS_FROM_START.",
        ),
      );
      continue;
    }

    try {
      const parsedOrderDate = parseDateOnly(orderDate);
      const effectiveStartDate = resolveEffectiveStartDate({
        orderDate: parsedOrderDate,
        startDateType,
        startDate: record.StartDate ? parseDateOnly(record.StartDate) : null,
        startDays: record.StartDays ? Number(record.StartDays) : null,
      });
      resolveDueDate({
        orderDate: parsedOrderDate,
        effectiveStartDate,
        dueDateType,
        dueDate: record.DueDate ? parseDateOnly(record.DueDate) : null,
        dueDays: record.DueDays ? Number(record.DueDays) : null,
      });
    } catch (error) {
      issues.push(issue("Projects", row, "OrderDate", orderDate, error instanceof Error ? error.message : "Invalid date fields."));
      continue;
    }

    if (existing) {
      if (processCodes.length > 0) {
        const existingCodes = existing.processes.map((process) => normalizeCode(process.processCode)).join("|");
        const incoming = processCodes.join("|");
        if (existingCodes !== incoming) {
          issues.push(
            issue(
              "Projects",
              row,
              "ProcessCodes",
              incoming,
              "Historical process snapshot differs from the existing order. Existing snapshot will be preserved.",
              "Remove ProcessCodes for this existing project, or import under a new ProjectCode.",
              "warning",
            ),
          );
        }
      }
    } else if (processCodes.length === 0) {
      const mapping = mappings.find((row) => row.plantCode === plantCode && row.productCode === productCode && row.action !== "skip");
      const catalogMapping = catalog.mappings.find(
        (row) => normalizeCode(row.plantCode) === plantCode && normalizeCode(row.productCode) === productCode,
      );
      const codes = mapping?.processCodes ?? catalogMapping?.processCodes ?? [];
      if (codes.length === 0) {
        issues.push(
          issue(
            "Projects",
            row,
            "ProcessCodes",
            "",
            "No process snapshot provided and no plant/product mapping exists.",
            "Provide ProcessCodes or add a ProcessMappings row.",
          ),
        );
        continue;
      }
      plannedSnapshots.set(projectCode, codes);
    } else {
      let invalid = false;
      for (const processCode of processCodes) {
        if (!knownProcess(processCode)) {
          issues.push(issue("Projects", row, "ProcessCodes", processCode, `ProcessCode: ${processCode} does not exist.`));
          invalid = true;
        }
      }
      if (invalid) {
        continue;
      }
      plannedSnapshots.set(projectCode, processCodes);
    }

    if (projectCodesInFile.has(projectCode)) {
      issues.push(issue("Projects", row, "ProjectCode", projectCode, "Duplicate ProjectCode in the workbook."));
      continue;
    }
    projectCodesInFile.add(projectCode);

    const action = decideAction(Boolean(existing), strategy, "Projects", row, "ProjectCode", projectCode, issues);
    if (action === "fail") {
      continue;
    }

    projects.push({
      sheetRow: row,
      action,
      projectCode,
      clientCode,
      plantCode,
      productCode,
      quantity,
      orderDate,
      startDateType,
      startDate: emptyToNull(record.StartDate ?? ""),
      startDays: record.StartDays ? Number(record.StartDays) : null,
      dueDateType,
      dueDate: emptyToNull(record.DueDate ?? ""),
      dueDays: record.DueDays ? Number(record.DueDays) : null,
      priority: (["LOW", "NORMAL", "HIGH", "URGENT"].includes((record.Priority ?? "").toUpperCase())
        ? (record.Priority ?? "NORMAL").toUpperCase()
        : "NORMAL") as ProjectImportRow["priority"],
      remarks: emptyToNull(record.Remarks ?? ""),
      processCodes: plannedSnapshots.get(projectCode) ?? processCodes,
      preserveExistingSnapshot: Boolean(existing),
    });
  }

  const productionEntries: ProductionEntryImportRow[] = [];
  const simulatedEntries = new Map<string, { orderProcessId: string; quantity: number }[]>();
  for (const order of catalog.orders) {
    simulatedEntries.set(normalizeCode(order.orderNumber), [...order.entries]);
  }

  for (const record of workbook.productionEntries) {
    const row = rowNum(record);
    const projectCode = normalizeCode(record.ProjectCode ?? "");
    const processCode = normalizeCode(record.ProcessCode ?? "");
    const entryDate = (record.EntryDate ?? "").trim();
    const quantity = Number(record.Quantity ?? "");

    if (!projectCode || !processCode || !entryDate) {
      issues.push(issue("ProductionEntries", row, "ProjectCode", projectCode, "ProjectCode, ProcessCode, and EntryDate are required."));
      continue;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      issues.push(issue("ProductionEntries", row, "Quantity", String(record.Quantity ?? ""), "Quantity must be a positive incremental integer."));
      continue;
    }
    try {
      parseDateOnly(entryDate);
    } catch {
      issues.push(issue("ProductionEntries", row, "EntryDate", entryDate, "EntryDate must be YYYY-MM-DD."));
      continue;
    }

    const existingOrder = orderByNumber.get(projectCode);
    const projectRow = projects.find((item) => item.projectCode === projectCode && item.action !== "skip");
    if (!existingOrder && !projectRow) {
      issues.push(issue("ProductionEntries", row, "ProjectCode", projectCode, "ProjectCode does not exist.", "Add the project on the Projects sheet first."));
      continue;
    }
    if (projectRow && catalog.grantedPlantCodes && !catalog.grantedPlantCodes.has(projectRow.plantCode)) {
      issues.push(issue("ProductionEntries", row, "ProjectCode", projectCode, "You do not have access to this plant."));
      continue;
    }
    if (existingOrder && catalog.grantedPlantCodes && !catalog.grantedPlantCodes.has(existingOrder.plantCode)) {
      issues.push(issue("ProductionEntries", row, "ProjectCode", projectCode, "You do not have access to this plant."));
      continue;
    }

    const snapshotCodes = existingOrder
      ? existingOrder.processes.map((process) => normalizeCode(process.processCode))
      : (projectRow?.processCodes ?? []);
    if (!snapshotCodes.includes(processCode)) {
      issues.push(
        issue(
          "ProductionEntries",
          row,
          "ProcessCode",
          processCode,
          `ProcessCode: ${processCode} does not exist on this order's process snapshot.`,
          "Use a process from the historical order snapshot, not only the current master mapping.",
        ),
      );
      continue;
    }

    const processesForValidation = existingOrder
      ? existingOrder.processes.map((process) => ({
          id: process.id,
          sequence: process.sequence,
          processName: process.processName,
          processCode: process.processCode,
          plannedQuantity: process.plannedQuantity,
        }))
      : snapshotCodes.map((code, index) => ({
          id: code,
          sequence: index + 1,
          processName: code,
          processCode: code,
          plannedQuantity: projectRow?.quantity ?? 0,
        }));

    const orderProcessId = existingOrder
      ? (existingOrder.processes.find((process) => normalizeCode(process.processCode) === processCode)?.id ?? processCode)
      : processCode;

    const current = simulatedEntries.get(projectCode) ?? [];
    try {
      assertValidProductionEntry({
        quantity,
        lifecycleStatus: existingOrder?.lifecycleStatus ?? "NOT_STARTED",
        processes: processesForValidation,
        orderProcessId,
        existingEntries: current,
      });
      current.push({ orderProcessId, quantity });
      simulatedEntries.set(projectCode, current);
    } catch (error) {
      issues.push(
        issue(
          "ProductionEntries",
          row,
          "Quantity",
          String(quantity),
          error instanceof Error ? error.message : "Invalid production quantity.",
          "Entries are incremental. Check upstream stage cumulatives.",
        ),
      );
      continue;
    }

    productionEntries.push({
      sheetRow: row,
      action: "create",
      projectCode,
      processCode,
      entryDate,
      quantity,
      remarks: emptyToNull(record.Remarks ?? ""),
    });
  }

  const specialActivityEntries: SpecialActivityEntryImportRow[] = [];
  for (const record of workbook.specialActivityEntries) {
    const row = rowNum(record);
    const projectCode = normalizeCode(record.ProjectCode ?? "");
    const activityCode = normalizeCode(record.ActivityCode ?? "");
    const processCode = normalizeCode(record.ProcessCode ?? "") || null;
    const entryDate = (record.EntryDate ?? "").trim();
    const quantity = Number(record.Quantity ?? "");
    if (!projectCode || !activityCode || !entryDate || !Number.isInteger(quantity) || quantity <= 0) {
      issues.push(issue("SpecialActivityEntries", row, "ActivityCode", activityCode, "ProjectCode, ActivityCode, EntryDate, and positive Quantity are required."));
      continue;
    }
    if (!activityByCode.has(activityCode) && !activityCodesInFile.has(activityCode)) {
      issues.push(issue("SpecialActivityEntries", row, "ActivityCode", activityCode, "ActivityCode does not exist."));
      continue;
    }
    if (!orderByNumber.has(projectCode) && !projectCodesInFile.has(projectCode)) {
      issues.push(issue("SpecialActivityEntries", row, "ProjectCode", projectCode, "ProjectCode does not exist."));
      continue;
    }
    specialActivityEntries.push({
      sheetRow: row,
      action: "create",
      projectCode,
      activityCode,
      processCode,
      entryDate,
      quantity,
      remarks: emptyToNull(record.Remarks ?? ""),
    });
  }

  const payload: ImportPreviewPayload = {
    plants,
    clients,
    products,
    processes,
    mappings,
    specialActivities,
    projects,
    productionEntries,
    specialActivityEntries,
  };

  const summaries = summarize(payload, issues);
  return { payload, issues, summaries };
}

function summarize(payload: ImportPreviewPayload, issues: ImportIssue[]): SheetSummary[] {
  const defs: { sheet: string; rows: { action: string }[] }[] = [
    { sheet: "Plants", rows: payload.plants },
    { sheet: "Clients", rows: payload.clients },
    { sheet: "Products", rows: payload.products },
    { sheet: "Processes", rows: payload.processes },
    { sheet: "ProcessMappings", rows: payload.mappings },
    { sheet: "SpecialActivities", rows: payload.specialActivities },
    { sheet: "Projects", rows: payload.projects },
    { sheet: "ProductionEntries", rows: payload.productionEntries },
    { sheet: "SpecialActivityEntries", rows: payload.specialActivityEntries },
  ];

  return defs.map((def) => ({
    sheet: def.sheet,
    newCount: def.rows.filter((row) => row.action === "create").length,
    updateCount: def.rows.filter((row) => row.action === "update").length,
    skipCount: def.rows.filter((row) => row.action === "skip").length,
    errorCount: issues.filter((issueRow) => issueRow.sheet === def.sheet && issueRow.level === "error").length,
    warningCount: issues.filter((issueRow) => issueRow.sheet === def.sheet && issueRow.level === "warning").length,
  }));
}

export function countImportRows(payload: ImportPreviewPayload): number {
  return (
    payload.plants.length +
    payload.clients.length +
    payload.products.length +
    payload.processes.length +
    payload.mappings.length +
    payload.specialActivities.length +
    payload.projects.length +
    payload.productionEntries.length +
    payload.specialActivityEntries.length
  );
}
