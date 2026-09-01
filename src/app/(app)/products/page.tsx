import type { Metadata } from "next";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canManageMasters } from "@/lib/plants/scope";
import { MasterList } from "@/components/masters/master-list";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const params = await searchParams;
  const manage = canManageMasters(context.role);
  const products = await prisma.product.findMany({
    where: { organizationId: context.organizationId },
    orderBy: { name: "asc" },
  });

  return (
    <MasterList
      title="Products"
      newHref={manage ? "/products/new" : undefined}
      empty="No products yet."
      savedMessage={params.saved}
      items={products.map((product) => ({
        id: product.id,
        title: product.name,
        subtitle: `${product.code} · ${product.isActive ? "Active" : "Inactive"}`,
        href: manage ? `/products/${product.id}/edit` : undefined,
      }))}
    />
  );
}
