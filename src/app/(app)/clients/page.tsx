import type { Metadata } from "next";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canManageMasters } from "@/lib/plants/scope";
import { MasterList } from "@/components/masters/master-list";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const params = await searchParams;
  const manage = canManageMasters(context.role);
  const clients = await prisma.client.findMany({
    where: { organizationId: context.organizationId },
    orderBy: { name: "asc" },
  });

  return (
    <MasterList
      title="Clients"
      newHref={manage ? "/clients/new" : undefined}
      empty="No clients yet."
      savedMessage={params.saved}
      items={clients.map((client) => ({
        id: client.id,
        title: client.name,
        subtitle: [client.code, client.contactName, client.contactEmail, client.isActive ? "Active" : "Inactive"]
          .filter(Boolean)
          .join(" · "),
        href: manage ? `/clients/${client.id}/edit` : undefined,
      }))}
    />
  );
}
