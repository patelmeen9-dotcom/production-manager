import type { Metadata } from "next";
import Link from "next/link";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";
import { ImportUploadForm } from "@/components/import/import-upload-form";
import { formatDateOnly } from "@/lib/orders/date-rules";

export const metadata: Metadata = { title: "Import Center" };

export default async function ImportCenterPage() {
  const context = await requireMasterWriter();
  const jobs = await prisma.importJob.findMany({
    where: { organizationId: context.organizationId },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Import Center</h1>
        <p className="mt-1 text-sm text-slate-400">
          Controlled Excel migration. Files are validated and previewed before any production tables are written.
          Organization context always comes from your signed-in account.
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-sky-400 hover:text-sky-300" href="/api/import/template">
            Download import template
          </Link>
        </div>
        <ImportUploadForm />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium text-white">Import history</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="p-2">When</th>
              <th className="p-2">File</th>
              <th className="p-2">Status</th>
              <th className="p-2">Rows</th>
              <th className="p-2">By</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-slate-800 text-slate-200">
                <td className="p-2">{formatDateOnly(job.createdAt)}</td>
                <td className="p-2">{job.fileName}</td>
                <td className="p-2">{job.status}</td>
                <td className="p-2">
                  {job.successfulRows}/{job.totalRows} · err {job.failedRows}
                </td>
                <td className="p-2">{job.uploadedBy.name}</td>
                <td className="p-2">
                  <Link className="text-sky-400" href={`/import/${job.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
