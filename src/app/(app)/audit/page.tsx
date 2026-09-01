import type { Metadata } from "next";
import { Role } from "@prisma/client";
import { requireRoles, requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateOnly } from "@/lib/orders/date-rules";
import { toPageParams } from "@/lib/pagination";
import { Pager } from "@/components/ui/pager";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  await requireRoles([Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN, Role.PRODUCTION_MANAGER]);
  const params = await searchParams;
  const { page, pageSize, skip } = toPageParams({ page: params.page });

  const where = { organizationId: context.organizationId };
  const [totalCount, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Audit trail</h1>
      <p className="text-sm text-slate-400">
        Recent production-related changes. Older rows stay in PostgreSQL and are paged, not bulk-downloaded.
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400">
          <tr>
            <th className="p-2">When</th>
            <th className="p-2">User</th>
            <th className="p-2">Action</th>
            <th className="p-2">Entity</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-slate-800 text-slate-200">
              <td className="p-2">
                {formatDateOnly(log.createdAt)} {log.createdAt.toISOString().slice(11, 16)}
              </td>
              <td className="p-2">{log.user.name}</td>
              <td className="p-2">{log.action}</td>
              <td className="p-2">
                {log.entityType} · {log.entityId}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager basePath="/audit" page={page} pageSize={pageSize} totalCount={totalCount} />
    </main>
  );
}
