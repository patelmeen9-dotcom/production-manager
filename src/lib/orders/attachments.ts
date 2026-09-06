import path from "path";
import fs from "fs/promises";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "orders");

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls (also allow for safety)
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([".xlsx", ".pdf"]);

export type AttachmentFileType = "XLSX" | "PDF";

export function detectFileType(fileName: string, mimeType: string): AttachmentFileType | null {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".xlsx" || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "XLSX";
  }
  if (ext === ".pdf" || mimeType === "application/pdf") {
    return "PDF";
  }
  return null;
}

export function isAllowedFile(fileName: string, mimeType: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) || ALLOWED_MIME_TYPES.has(mimeType);
}

/** Ensure the upload directory exists. */
async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

/**
 * Persist a file buffer to disk under uploads/orders/<orderId>/.
 * Returns the relative storagePath stored in the DB.
 */
export async function saveOrderAttachment(
  orderId: string,
  fileName: string,
  buffer: Buffer,
): Promise<string> {
  await ensureUploadsDir();
  const orderDir = path.join(UPLOADS_DIR, orderId);
  await fs.mkdir(orderDir, { recursive: true });

  // Sanitise the original file name and add a timestamp prefix to avoid collisions.
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const unique = `${Date.now()}_${safeName}`;
  const filePath = path.join(orderDir, unique);

  await fs.writeFile(filePath, buffer);
  // Store relative path so the app works regardless of cwd at read-time.
  return path.join("orders", orderId, unique);
}

/** Resolve a storagePath from the DB back to an absolute filesystem path. */
export function resolveAttachmentPath(storagePath: string): string {
  return path.join(process.cwd(), "uploads", storagePath);
}

/** Delete the physical file for an attachment. Does not throw if missing. */
export async function deleteAttachmentFile(storagePath: string): Promise<void> {
  try {
    await fs.unlink(resolveAttachmentPath(storagePath));
  } catch {
    // File may have already been removed; ignore.
  }
}
