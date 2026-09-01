import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { UserPlantAccessForm } from "@/components/users/user-plant-access-form";
import { requireRoles } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { SavedBanner } from "@/components/ui/saved-banner";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireRoles([Role.SUPER_ADMIN, Role.ORGANIZATION_ADMIN]);
  const params = await searchParams;
  if (!context.organizationId) {
    redirect("/dashboard");
  }

  const [users, plants] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: context.organizationId },
      include: { plantAccess: true },
      orderBy: { name: "asc" },
    }),
    prisma.plant.findMany({
      where: { organizationId: context.organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Users and plant access</h1>
      <SavedBanner message={params.saved} />
      <p className="text-sm text-slate-400">
        Organization admins have All Plants by role. Other users only see plants granted here.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {users.map((user) => (
          <div key={user.id}>
            <p className="mb-2 text-xs text-slate-500">{user.email} · {user.role}</p>
            {user.role === Role.ORGANIZATION_ADMIN ? (
              <div className="rounded-lg border border-slate-800 p-4 text-sm text-slate-300">
                {user.name} has All Plants by role. Explicit grants are optional.
              </div>
            ) : (
              <UserPlantAccessForm
                userId={user.id}
                userName={user.name}
                plants={plants.map((plant) => ({ id: plant.id, name: plant.name }))}
                grantedPlantIds={user.plantAccess.map((row) => row.plantId)}
              />
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
