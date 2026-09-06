-- CreateEnum
CREATE TYPE "public"."AttachmentFileType" AS ENUM ('XLSX', 'PDF');

-- AlterTable
ALTER TABLE "public"."ProductCategoryOption" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."ProductionOrderLineMaterial" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "public"."ProductionOrderAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" "public"."AttachmentFileType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionOrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionOrderAttachment_organizationId_productionOrderId_idx" ON "public"."ProductionOrderAttachment"("organizationId", "productionOrderId");

-- AddForeignKey
ALTER TABLE "public"."ProductionOrderAttachment" ADD CONSTRAINT "ProductionOrderAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionOrderAttachment" ADD CONSTRAINT "ProductionOrderAttachment_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "public"."ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."ProductionOrderLineCategoryOption_selectionId_categoryOptionId_" RENAME TO "ProductionOrderLineCategoryOption_selectionId_categoryOptio_key";

-- RenameIndex
ALTER INDEX "public"."ProductionOrderLineCategorySelection_organizationId_productionO" RENAME TO "ProductionOrderLineCategorySelection_organizationId_product_idx";

-- RenameIndex
ALTER INDEX "public"."ProductionOrderLineCategorySelection_productionOrderLineId_prod" RENAME TO "ProductionOrderLineCategorySelection_productionOrderLineId__key";

-- RenameIndex
ALTER INDEX "public"."ProductionOrderLineMaterial_organizationId_productionOrderLineI" RENAME TO "ProductionOrderLineMaterial_organizationId_productionOrderL_idx";

-- RenameIndex
ALTER INDEX "public"."ProductionOrderSpecialActivity_organizationId_productionOrderId" RENAME TO "ProductionOrderSpecialActivity_organizationId_productionOrd_idx";

-- RenameIndex
ALTER INDEX "public"."ProductionOrderSpecialActivity_productionOrderId_specialActivit" RENAME TO "ProductionOrderSpecialActivity_productionOrderId_specialAct_key";
