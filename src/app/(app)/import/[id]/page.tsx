import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImportJobStatus } from "@prisma/client";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";
import { confirmImportAction, cancelImportAction } from "@/lib/import/actions";
import type { ImportIssue, SheetSummary } from "@/lib/import/types";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Import preview" };

export default async function ImportJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireMasterWriter();
  const { id } = await params;
  const query = await searchParams;
  const job = await prisma.importJob.findFirst({
    where: { id, organizationId: context.organizationId },
    include: { uploadedBy: { select: { name: true } } },
  });
  if (!job) {
    notFound();
  }

  const summaries = (job.summary as SheetSummary[] | null) ?? [];
  const issues = (job.errorReport as ImportIssue[] | null) ?? [];
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const committed = query.committed === "1" || job.status === ImportJobStatus.COMMITTED;

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Import preview</h1>
        <p className="text-sm text-slate-400">
          {job.fileName} · {job.status} · uploaded by {job.uploadedBy.name}
        </p>
      </div>

      {committed ? (
        <p className="rounded-md border border-emerald-700/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          Import committed. {job.successfulRows} rows written. Historical entries remain incremental transactions.
        </p>
      ) : null}

      <section>
        <h2 className="mb-2 text-lg font-medium text-white">Summary</h2>
        <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
          {summaries.map((summary) => (
            <li key={summary.sheet} className="p-3 text-sm text-slate-200">
              {summary.sheet} — New: {summary.newCount}, Update: {summary.updateCount}, Skip: {summary.skipCount},
              Errors: {summary.errorCount}, Warnings: {summary.warningCount}
            </li>
          ))}
        </ul>
      </section>

      {errors.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">Validation errors</h2>
            <Link className="text-sm text-sky-400" href={`/api/import/${job.id}/errors`}>
              Download error report (CSV)
            </Link>
          </div>
          <ul className="max-h-80 space-y-2 overflow-auto rounded-lg border border-slate-800 p-3 text-sm text-red-200">
            {errors.slice(0, 100).map((issue, index) => (
              <li key={`${issue.sheet}-${issue.row}-${index}`}>
                {issue.sheet}, Row {issue.row}, {issue.column}: {issue.value || "(empty)"} — {issue.error}
                {issue.suggestion ? ` Suggested: ${issue.suggestion}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-400">Correct the Excel file and re-upload. Nothing has been written yet.</p>
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-medium text-white">Warnings</h2>
          <ul className="max-h-48 space-y-2 overflow-auto rounded-lg border border-slate-800 p-3 text-sm text-amber-200">
            {warnings.slice(0, 50).map((issue, index) => (
              <li key={`${issue.sheet}-${issue.row}-w-${index}`}>
                {issue.sheet}, Row {issue.row}, {issue.column}: {issue.error}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {job.status === ImportJobStatus.VALIDATED ? (
          <form action={confirmImportAction.bind(null, job.id)}>
            <Button type="submit">Confirm import</Button>
          </form>
        ) : null}
        {job.status === ImportJobStatus.VALIDATED || job.status === ImportJobStatus.VALIDATION_FAILED ? (
          <form action={cancelImportAction.bind(null, job.id)}>
            <Button type="submit" variant="secondary">
              Cancel
            </Button>
          </form>
        ) : null}
        <Link className="self-center text-sm text-sky-400" href="/import">
          Back to Import Center
        </Link>
      </div>
    </main>
  );
}
