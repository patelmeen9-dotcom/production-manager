import type { Metadata } from "next";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canManageMasters } from "@/lib/plants/scope";
import { MasterList } from "@/components/masters/master-list";

export const metadata: Metadata = { title: "Special activities" };

export default async function SpecialActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const params = await searchParams;
  const manage = canManageMasters(context.role);
  const activities = await prisma.specialActivity.findMany({
    where: { organizationId: context.organizationId },
    orderBy: { name: "asc" },
  });

  return (
    <MasterList
      title="Special activities"
      newHref={manage ? "/special-activities/new" : undefined}
      empty="No special activities yet. These stay outside the main process sequence."
      savedMessage={params.saved}
      items={activities.map((activity) => ({
        id: activity.id,
        title: activity.name,
        subtitle: `${activity.code} · ${activity.activityType} · ${activity.isActive ? "Active" : "Inactive"}`,
        href: manage ? `/special-activities/${activity.id}/edit` : undefined,
      }))}
    />
  );
}
