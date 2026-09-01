import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { OrganizationForm } from "@/components/organization/organization-form";
import { requireRoles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseOrganizationSettings } from "@/lib/organization-settings";
import { SavedBanner } from "@/components/ui/saved-banner";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireRoles([Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN]);
  const params = await searchParams;
  if (!context.organizationId) {
    redirect("/dashboard");
  }

  const organization = await prisma.organization.findFirst({
    where: { id: context.organizationId },
  });
  if (!organization) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Organization</h1>
      <SavedBanner message={params.saved} />
      <p className="text-sm text-slate-400">
        Delay thresholds are stored on the organization and used by calculation services. They are not hard-coded in
        UI routes.
      </p>
      <OrganizationForm name={organization.name} settings={parseOrganizationSettings(organization.settings)} />
    </main>
  );
}
