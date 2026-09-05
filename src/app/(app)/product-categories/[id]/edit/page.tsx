import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCategoryForm } from "@/components/masters/product-category-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Edit product category" };

export default async function EditProductCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireMasterWriter();
  const { id } = await params;
  const category = await prisma.productCategory.findFirst({
    where: { id, organizationId },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  if (!category) {
    notFound();
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Edit product category</h1>
      <ProductCategoryForm
        category={{
          id: category.id,
          code: category.code,
          name: category.name,
          inputType: category.inputType,
          choiceMode: category.choiceMode,
          isActive: category.isActive,
          options: category.options,
        }}
      />
    </main>
  );
}
