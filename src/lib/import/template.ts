import ExcelJS from "exceljs";

type ColumnDef = { key: string; required?: boolean; note?: string };

const SHEETS: { name: string; columns: ColumnDef[]; examples: Record<string, string>[] }[] = [
  {
    name: "Plants",
    columns: [
      { key: "PlantCode", required: true, note: "Stable code, e.g. PLANT-MUM" },
      { key: "PlantName", required: true },
      { key: "Location" },
      { key: "IsActive", note: "true/false" },
    ],
    examples: [{ PlantCode: "PLANT-MUM", PlantName: "Mumbai Plant", Location: "Mumbai", IsActive: "true" }],
  },
  {
    name: "Clients",
    columns: [
      { key: "ClientCode", required: true },
      { key: "ClientName", required: true },
      { key: "ContactName" },
      { key: "ContactEmail" },
      { key: "ContactPhone" },
      { key: "IsActive" },
    ],
    examples: [
      {
        ClientCode: "CLIENT-01",
        ClientName: "Client A",
        ContactName: "Priya Shah",
        ContactEmail: "priya@client-a.example",
        ContactPhone: "",
        IsActive: "true",
      },
    ],
  },
  {
    name: "Products",
    columns: [
      { key: "ProductCode", required: true },
      { key: "ProductName", required: true },
      { key: "IsActive" },
    ],
    examples: [{ ProductCode: "DOOR", ProductName: "Door", IsActive: "true" }],
  },
  {
    name: "Processes",
    columns: [
      { key: "ProcessCode", required: true },
      { key: "ProcessName", required: true },
      { key: "Description" },
      { key: "IsActive" },
    ],
    examples: [
      { ProcessCode: "CUT", ProcessName: "Cutting", Description: "", IsActive: "true" },
      { ProcessCode: "FRM", ProcessName: "Framing", Description: "", IsActive: "true" },
    ],
  },
  {
    name: "ProcessMappings",
    columns: [
      { key: "PlantCode", required: true },
      { key: "ProductCode", required: true },
      { key: "ProcessCodes", required: true, note: "Ordered codes separated by | e.g. CUT|FRM|ASM" },
    ],
    examples: [{ PlantCode: "PLANT-MUM", ProductCode: "DOOR", ProcessCodes: "CUT|FRM|ASM|GLS|FIN" }],
  },
  {
    name: "SpecialActivities",
    columns: [
      { key: "ActivityCode", required: true },
      { key: "ActivityName", required: true },
      { key: "ActivityType", required: true, note: "SPECIAL_PROCESS | REWORK | OTHER" },
      { key: "IsActive" },
    ],
    examples: [
      {
        ActivityCode: "REWORK",
        ActivityName: "Rework",
        ActivityType: "REWORK",
        IsActive: "true",
      },
    ],
  },
  {
    name: "Projects",
    columns: [
      { key: "ProjectCode", required: true, note: "Order/project number" },
      { key: "ClientCode", required: true },
      { key: "PlantCode", required: true },
      { key: "ProductCode", required: true },
      { key: "Quantity", required: true },
      { key: "OrderDate", required: true, note: "YYYY-MM-DD" },
      { key: "StartDateType", note: "NONE | FIXED_DATE | DAYS_FROM_ORDER" },
      { key: "StartDate", note: "YYYY-MM-DD when FIXED_DATE" },
      { key: "StartDays" },
      { key: "DueDateType", required: true, note: "FIXED_DATE | DAYS_FROM_ORDER | DAYS_FROM_START" },
      { key: "DueDate" },
      { key: "DueDays" },
      { key: "Priority", note: "LOW|NORMAL|HIGH|URGENT" },
      { key: "Remarks" },
      {
        key: "ProcessCodes",
        note: "Historical snapshot order. Leave blank on new projects to use current mapping.",
      },
    ],
    examples: [
      {
        ProjectCode: "ABC-001",
        ClientCode: "CLIENT-01",
        PlantCode: "PLANT-MUM",
        ProductCode: "DOOR",
        Quantity: "500",
        OrderDate: "2026-08-30",
        StartDateType: "NONE",
        StartDate: "",
        StartDays: "",
        DueDateType: "DAYS_FROM_START",
        DueDate: "",
        DueDays: "21",
        Priority: "NORMAL",
        Remarks: "Historical import example",
        ProcessCodes: "CUT|FRM|ASM|GLS|FIN",
      },
    ],
  },
  {
    name: "ProductionEntries",
    columns: [
      { key: "ProjectCode", required: true },
      { key: "ProcessCode", required: true },
      { key: "EntryDate", required: true, note: "YYYY-MM-DD" },
      { key: "Quantity", required: true, note: "Incremental quantity, not cumulative" },
      { key: "Remarks" },
    ],
    examples: [
      { ProjectCode: "ABC-001", ProcessCode: "CUT", EntryDate: "2026-08-30", Quantity: "200", Remarks: "" },
      { ProjectCode: "ABC-001", ProcessCode: "CUT", EntryDate: "2026-08-31", Quantity: "300", Remarks: "" },
      { ProjectCode: "ABC-001", ProcessCode: "FRM", EntryDate: "2026-08-31", Quantity: "150", Remarks: "" },
    ],
  },
  {
    name: "SpecialActivityEntries",
    columns: [
      { key: "ProjectCode", required: true },
      { key: "ActivityCode", required: true },
      { key: "ProcessCode", note: "Optional related stage" },
      { key: "EntryDate", required: true },
      { key: "Quantity", required: true },
      { key: "Remarks" },
    ],
    examples: [],
  },
];

export async function buildImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Production Manager";

  const guide = workbook.addWorksheet("README");
  guide.addRow(["Production Manager import template"]);
  guide.addRow(["Dates must be YYYY-MM-DD."]);
  guide.addRow(["Use stable codes (PlantCode, ClientCode, ProductCode, ProcessCode, ProjectCode, ActivityCode)."]);
  guide.addRow(["Do not put organization IDs in the file. Organization is taken from the signed-in user."]);
  guide.addRow(["ProductionEntries Quantity is incremental, not cumulative."]);
  guide.addRow(["Projects.ProcessCodes preserves the historical process snapshot for that order."]);
  guide.addRow(["Import order: Plants → Clients → Products → Processes → ProcessMappings → SpecialActivities → Projects → ProductionEntries → SpecialActivityEntries"]);

  for (const sheetDef of SHEETS) {
    const sheet = workbook.addWorksheet(sheetDef.name);
    sheet.addRow(sheetDef.columns.map((column) => column.key));
    sheet.addRow(sheetDef.columns.map((column) => (column.required ? "REQUIRED" : "optional") + (column.note ? ` — ${column.note}` : "")));
    for (const example of sheetDef.examples) {
      sheet.addRow(sheetDef.columns.map((column) => example[column.key] ?? ""));
    }
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function buildErrorReportCsv(errors: {
  sheet: string;
  row: number;
  column: string;
  value: string;
  error: string;
  suggestion?: string;
}[]): Promise<string> {
  const header = "Sheet,Row,Column,Value,Error,SuggestedCorrection";
  const lines = errors.map((issue) =>
    [issue.sheet, issue.row, issue.column, issue.value, issue.error, issue.suggestion ?? ""]
      .map((part) => `"${String(part).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header, ...lines].join("\n");
}
