import { NextResponse } from "next/server";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";
import { buildErrorReportCsv } from "@/lib/import/template";
import type { ImportIssue } from "@/lib/import/types";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMasterWriter();
  const { id } = await context.params;
  const job = await prisma.importJob.findFirst({
    where: { id, organizationId: auth.organizationId },
  });
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const issues = (job.errorReport as ImportIssue[] | null) ?? [];
  const csv = await buildErrorReportCsv(issues);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="import-errors-${job.id}.csv"`,
    },
  });
}
