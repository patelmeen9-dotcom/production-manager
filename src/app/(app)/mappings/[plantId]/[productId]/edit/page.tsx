import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProcessMappingForm } from "@/components/masters/process-mapping-form";
import { requireMasterWriter } from "@/lib/masters/auth";
import { prisma } from "@/lib/db";
import { requireGrantedPlant } from "@/lib/plants/access";

export const metadata: Metadata = { title: "Edit process mapping" };

export default async function EditMappingPage({
  params,
}: {
  params: Promise<{ plantId: string; productId: string }>;
}) {
  const context = await requireMasterWriter();
  const { plantId, productId } = await params;
  await requireGrantedPlant(context, plantId);

  const [plant, product, processes, mappingRows] = await Promise.all([
    prisma.plant.findFirst({ where: { id: plantId, organizationId: context.organizationId } }),
    prisma.product.findFirst({ where: { id: productId, organizationId: context.organizationId } }),
    prisma.process.findMany({
      where: { organizationId: context.organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.plantProductProcessMapping.findMany({
      where: { organizationId: context.organizationId, plantId, productId },
      orderBy: { sequence: "asc" },
    }),
  ]);

  if (!plant || !product || mappingRows.length === 0) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-white">Edit process mapping</h1>
      <p className="text-sm text-slate-400">
        {plant.name} · {product.name}
      </p>
      <ProcessMappingForm
        plants={[{ id: plant.id, name: plant.name }]}
        products={[{ id: product.id, name: product.name, code: product.code }]}
        processes={processes}
        defaultPlantId={plant.id}
        defaultProductId={product.id}
        defaultProcessIds={mappingRows.map((row) => row.processId)}
      />
    </main>
  );
}
