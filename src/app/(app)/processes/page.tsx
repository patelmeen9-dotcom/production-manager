import type { Metadata } from "next";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canManageMasters } from "@/lib/plants/scope";
import { MasterList } from "@/components/masters/master-list";

export const metadata: Metadata = { title: "Processes" };

export default async function ProcessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const params = await searchParams;
  const manage = canManageMasters(context.role);
  const processes = await prisma.process.findMany({
    where: { organizationId: context.organizationId },
    orderBy: { name: "asc" },
  });

  return (
    <MasterList
      title="Processes"
      newHref={manage ? "/processes/new" : undefined}
      empty="No processes yet. Add reusable stages here; do not hard-code them."
      savedMessage={params.saved}
      items={processes.map((process) => ({
        id: process.id,
        title: process.name,
        subtitle: `${process.code}${process.unitsPerDay != null ? ` · ${process.unitsPerDay}/day` : ""} · ${process.isActive ? "Active" : "Inactive"}`,
        href: manage ? `/processes/${process.id}/edit` : undefined,
      }))}
    />
  );
}
