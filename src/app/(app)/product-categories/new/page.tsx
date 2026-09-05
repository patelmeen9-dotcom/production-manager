import type { Metadata } from "next";
import { ProductCategoryForm } from "@/components/masters/product-category-form";
import { requireMasterWriter } from "@/lib/masters/auth";

export const metadata: Metadata = { title: "New product category" };

export default async function NewProductCategoryPage() {
  await requireMasterWriter();
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New product category</h1>
      <ProductCategoryForm />
    </main>
  );
}
