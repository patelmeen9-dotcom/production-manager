import type { Metadata } from "next";
import { requireTenantContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { canManageMasters } from "@/lib/plants/scope";
import { MasterList } from "@/components/masters/master-list";

export const metadata: Metadata = { title: "Product categories" };

export default async function ProductCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireTenantContext();
  const params = await searchParams;
  const manage = canManageMasters(context.role);
  const categories = await prisma.productCategory.findMany({
    where: { organizationId: context.organizationId },
    orderBy: { name: "asc" },
  });

  return (
    <MasterList
      title="Product categories"
      newHref={manage ? "/product-categories/new" : undefined}
      empty="No product categories yet."
      savedMessage={params.saved}
      items={categories.map((category) => ({
        id: category.id,
        title: category.name,
        subtitle: [
          category.code,
          category.inputType === "DROPDOWN"
            ? `Dropdown · ${category.choiceMode === "MULTI" ? "multi" : "single"}`
            : "Open text",
          category.isActive ? "Active" : "Inactive",
        ].join(" · "),
        href: manage ? `/product-categories/${category.id}/edit` : undefined,
      }))}
    />
  );
}
