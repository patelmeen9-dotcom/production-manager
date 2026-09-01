import ExcelJS from "exceljs";
import type { ParsedWorkbook } from "@/lib/import/types";

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "");
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (typeof value === "object" && "result" in value) {
    return String(value.result ?? "").trim();
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function readSheet(workbook: ExcelJS.Workbook, name: string): Record<string, string>[] {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) {
    return [];
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = normalizeHeader(cell.value);
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const record: Record<string, string> = { __row: String(rowNumber) };
    let hasValue = false;
    headers.forEach((header, col) => {
      if (!header || header === "__row") {
        return;
      }
      const value = cellToString(row.getCell(col).value);
      record[header] = value;
      if (value) {
        hasValue = true;
      }
    });
    if (hasValue) {
      rows.push(record);
    }
  });
  return rows;
}

export async function parseImportWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  return {
    plants: readSheet(workbook, "Plants"),
    clients: readSheet(workbook, "Clients"),
    products: readSheet(workbook, "Products"),
    processes: readSheet(workbook, "Processes"),
    mappings: readSheet(workbook, "ProcessMappings"),
    specialActivities: readSheet(workbook, "SpecialActivities"),
    projects: readSheet(workbook, "Projects"),
    productionEntries: readSheet(workbook, "ProductionEntries"),
    specialActivityEntries: readSheet(workbook, "SpecialActivityEntries"),
  };
}

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function parseOptionalBool(value: string, fallback = true): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "active"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "inactive"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function parsePipeList(value: string): string[] {
  return value
    .split(/[|>,]/)
    .map((part) => normalizeCode(part))
    .filter(Boolean);
}
