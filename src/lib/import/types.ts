export const IMPORT_SHEET_ORDER = [
  "Plants",
  "Clients",
  "Products",
  "Processes",
  "ProcessMappings",
  "SpecialActivities",
  "Projects",
  "ProductionEntries",
  "SpecialActivityEntries",
] as const;

export type ImportSheetName = (typeof IMPORT_SHEET_ORDER)[number];

export type DuplicateStrategy = "CREATE_OR_UPDATE" | "SKIP_EXISTING" | "FAIL_ON_DUPLICATE";

export type ImportIssue = {
  sheet: string;
  row: number;
  column: string;
  value: string;
  error: string;
  suggestion?: string;
  level: "error" | "warning";
};

export type SheetSummary = {
  sheet: string;
  newCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  warningCount: number;
};

export type PlantImportRow = {
  sheetRow: number;
  action: "create" | "update" | "skip";
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
};

export type ClientImportRow = {
  sheetRow: number;
  action: "create" | "update" | "skip";
  code: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
};

export type ProductImportRow = {
  sheetRow: number;
  action: "create" | "update" | "skip";
  code: string;
  name: string;
  isActive: boolean;
};

export type ProcessImportRow = {
  sheetRow: number;
  action: "create" | "update" | "skip";
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type MappingImportRow = {
  sheetRow: number;
  action: "create" | "update" | "skip";
  plantCode: string;
  productCode: string;
  processCodes: string[];
};

export type SpecialActivityImportRow = {
  sheetRow: number;
  action: "create" | "update" | "skip";
  code: string;
  name: string;
  activityType: "SPECIAL_PROCESS" | "REWORK" | "OTHER";
  isActive: boolean;
};

export type ProjectImportRow = {
  sheetRow: number;
  action: "create" | "update" | "skip";
  projectCode: string;
  clientCode: string;
  plantCode: string;
  productCode: string;
  quantity: number;
  orderDate: string;
  startDateType: "NONE" | "FIXED_DATE" | "DAYS_FROM_ORDER";
  startDate: string | null;
  startDays: number | null;
  dueDateType: "FIXED_DATE" | "DAYS_FROM_ORDER" | "DAYS_FROM_START";
  dueDate: string | null;
  dueDays: number | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  remarks: string | null;
  /** Ordered process codes for historical snapshot. Empty = use current mapping on create only. */
  processCodes: string[];
  /** Existing orders keep their snapshot; never silently replace. */
  preserveExistingSnapshot: boolean;
};

export type ProductionEntryImportRow = {
  sheetRow: number;
  action: "create" | "skip";
  projectCode: string;
  processCode: string;
  entryDate: string;
  quantity: number;
  remarks: string | null;
};

export type SpecialActivityEntryImportRow = {
  sheetRow: number;
  action: "create" | "skip";
  projectCode: string;
  activityCode: string;
  processCode: string | null;
  entryDate: string;
  quantity: number;
  remarks: string | null;
};

export type ImportPreviewPayload = {
  plants: PlantImportRow[];
  clients: ClientImportRow[];
  products: ProductImportRow[];
  processes: ProcessImportRow[];
  mappings: MappingImportRow[];
  specialActivities: SpecialActivityImportRow[];
  projects: ProjectImportRow[];
  productionEntries: ProductionEntryImportRow[];
  specialActivityEntries: SpecialActivityEntryImportRow[];
};

export type ParsedWorkbook = {
  plants: Record<string, string>[];
  clients: Record<string, string>[];
  products: Record<string, string>[];
  processes: Record<string, string>[];
  mappings: Record<string, string>[];
  specialActivities: Record<string, string>[];
  projects: Record<string, string>[];
  productionEntries: Record<string, string>[];
  specialActivityEntries: Record<string, string>[];
};
