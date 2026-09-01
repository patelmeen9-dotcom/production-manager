import type { Metadata } from "next";
import { ProductForm } from "@/components/masters/product-form";
import { requireMasterWriter } from "@/lib/masters/auth";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireMasterWriter();
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">New product</h1>
      <ProductForm />
    </main>
  );
}
