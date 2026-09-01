import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/masters/product-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { organizationId } = await requireMasterWriter();
  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, organizationId } });
  if (!product) {
    notFound();
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Edit product</h1>
      <ProductForm product={product} />
    </main>
  );
}
