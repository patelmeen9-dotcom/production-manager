import type { Metadata } from "next";
import { ProductForm } from "@/components/masters/product-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const { organizationId } = await requireMasterWriter();
  const categories = await prisma.productCategory.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New product</h1>
      <ProductForm categories={categories} />
    </main>
  );
}
