import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/masters/product-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireMasterWriter();
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, organizationId },
      include: { categoryAssignments: { select: { productCategoryId: true } } },
    }),
    prisma.productCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);
  if (!product) {
    notFound();
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Edit product</h1>
      <ProductForm
        product={{
          id: product.id,
          name: product.name,
          code: product.code,
          details: product.details,
          isActive: product.isActive,
          categoryIds: product.categoryAssignments.map((row) => row.productCategoryId),
        }}
        categories={categories}
      />
    </main>
  );
}
