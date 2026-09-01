"use server";

import { ImportJobStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireMasterWriter } from "@/lib/masters/auth";
import { writeAuditLog } from "@/lib/audit/write";
import { loadOrgCatalog } from "@/lib/import/catalog";
import { parseImportWorkbook } from "@/lib/import/parse";
import { commitImportPayload, toPrismaDuplicateStrategy } from "@/lib/import/commit";
import { countImportRows, validateImportWorkbook } from "@/lib/import/validate";
import type { DuplicateStrategy, ImportPreviewPayload, SheetSummary, ImportIssue } from "@/lib/import/types";

export type ImportFormState = { error?: string };

export async function uploadImportAction(_prev: ImportFormState, formData: FormData): Promise<ImportFormState> {
  try {
    const context = await requireMasterWriter();
    const file = formData.get("file");
    const strategy = String(formData.get("duplicateStrategy") ?? "CREATE_OR_UPDATE") as DuplicateStrategy;

    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose an Excel (.xlsx) file." };
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return { error: "Only .xlsx workbooks are supported." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = await parseImportWorkbook(buffer);
    const catalog = await loadOrgCatalog(context);
    const { payload, issues, summaries } = validateImportWorkbook(workbook, catalog, strategy);
    const errors = issues.filter((issue) => issue.level === "error");
    const warnings = issues.filter((issue) => issue.level === "warning");
    const totalRows = countImportRows(payload) + errors.length;

    const job = await prisma.importJob.create({
      data: {
        organizationId: context.organizationId,
        uploadedByUserId: context.userId,
        fileName: file.name,
        importType: "FULL_WORKBOOK",
        duplicateStrategy: toPrismaDuplicateStrategy(strategy),
        status: errors.length > 0 ? ImportJobStatus.VALIDATION_FAILED : ImportJobStatus.VALIDATED,
        validatedAt: new Date(),
        totalRows,
        successfulRows: 0,
        failedRows: errors.length,
        warningCount: warnings.length,
        previewPayload: payload as unknown as Prisma.InputJsonValue,
        summary: summaries as unknown as Prisma.InputJsonValue,
        errorReport: issues as unknown as Prisma.InputJsonValue,
      },
    });

    await writeAuditLog({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "IMPORT_VALIDATE",
      entityType: "ImportJob",
      entityId: job.id,
      newValue: { fileName: file.name, errors: errors.length, warnings: warnings.length },
    });

    revalidatePath("/import");
    redirect(`/import/${job.id}`);
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    if (typeof error === "object" && error && "digest" in error) {
      throw error;
    }
    return { error: error instanceof Error ? error.message : "Could not validate import." };
  }
}

export async function confirmImportAction(jobId: string) {
  const context = await requireMasterWriter();
  const job = await prisma.importJob.findFirst({
    where: { id: jobId, organizationId: context.organizationId },
  });
  if (!job) {
    throw new AppError("NOT_FOUND", "Import job not found.", 404);
  }
  if (job.status !== ImportJobStatus.VALIDATED) {
    throw new AppError("VALIDATION", "Only validated imports without blocking errors can be confirmed.", 400);
  }
  if (!job.previewPayload) {
    throw new AppError("VALIDATION", "Import preview payload is missing. Re-upload the file.", 400);
  }

  try {
    const payload = job.previewPayload as unknown as ImportPreviewPayload;
    const result = await commitImportPayload({
      organizationId: context.organizationId,
      userId: context.userId,
      payload,
    });

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.COMMITTED,
        completedAt: new Date(),
        successfulRows: result.successfulRows,
        failedRows: 0,
        previewPayload: Prisma.JsonNull,
      },
    });

    await writeAuditLog({
      organizationId: context.organizationId,
      userId: context.userId,
      action: "IMPORT_COMMIT",
      entityType: "ImportJob",
      entityId: job.id,
      newValue: { successfulRows: result.successfulRows },
    });
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.FAILED,
        completedAt: new Date(),
        errorReport: [
          ...((job.errorReport as ImportIssue[] | null) ?? []),
          {
            sheet: "Commit",
            row: 0,
            column: "",
            value: "",
            error: error instanceof Error ? error.message : "Commit failed",
            level: "error",
          },
        ] as unknown as Prisma.InputJsonValue,
      },
    });
    throw error;
  }

  revalidatePath("/import");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  redirect(`/import/${jobId}?committed=1`);
}

export async function cancelImportAction(jobId: string) {
  const context = await requireMasterWriter();
  await prisma.importJob.updateMany({
    where: {
      id: jobId,
      organizationId: context.organizationId,
      status: { in: [ImportJobStatus.VALIDATED, ImportJobStatus.VALIDATION_FAILED, ImportJobStatus.UPLOADED] },
    },
    data: { status: ImportJobStatus.CANCELLED, completedAt: new Date(), previewPayload: Prisma.JsonNull },
  });
  revalidatePath("/import");
  redirect("/import");
}

export type { SheetSummary, ImportIssue };
