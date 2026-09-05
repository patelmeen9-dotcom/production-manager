-- Reshape product categories (input type + options), optional line category selections,
-- remove required line productCategoryId, add order-line materials.
-- Dummy/seed data may be reshaped; organizations and users are preserved.

-- 1) Enums
DO $$ BEGIN
  CREATE TYPE "CategoryInputType" AS ENUM ('OPEN_TEXT', 'DROPDOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CategoryChoiceMode" AS ENUM ('SINGLE', 'MULTI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Extend ProductCategory
ALTER TABLE "ProductCategory"
  ADD COLUMN IF NOT EXISTS "inputType" "CategoryInputType" NOT NULL DEFAULT 'OPEN_TEXT';
ALTER TABLE "ProductCategory"
  ADD COLUMN IF NOT EXISTS "choiceMode" "CategoryChoiceMode";

-- 3) Category options (dropdown values)
CREATE TABLE IF NOT EXISTS "ProductCategoryOption" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productCategoryId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCategoryOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategoryOption_productCategoryId_code_key"
  ON "ProductCategoryOption"("productCategoryId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategoryOption_productCategoryId_name_key"
  ON "ProductCategoryOption"("productCategoryId", "name");
CREATE INDEX IF NOT EXISTS "ProductCategoryOption_organizationId_productCategoryId_idx"
  ON "ProductCategoryOption"("organizationId", "productCategoryId");
CREATE INDEX IF NOT EXISTS "ProductCategoryOption_organizationId_isActive_idx"
  ON "ProductCategoryOption"("organizationId", "isActive");

ALTER TABLE "ProductCategoryOption" DROP CONSTRAINT IF EXISTS "ProductCategoryOption_organizationId_fkey";
ALTER TABLE "ProductCategoryOption"
  ADD CONSTRAINT "ProductCategoryOption_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductCategoryOption" DROP CONSTRAINT IF EXISTS "ProductCategoryOption_productCategoryId_fkey";
ALTER TABLE "ProductCategoryOption"
  ADD CONSTRAINT "ProductCategoryOption_productCategoryId_fkey"
  FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Line category selections
CREATE TABLE IF NOT EXISTS "ProductionOrderLineCategorySelection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productionOrderLineId" TEXT NOT NULL,
  "productCategoryId" TEXT NOT NULL,
  "textValue" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionOrderLineCategorySelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrderLineCategorySelection_productionOrderLineId_productCategoryId_key"
  ON "ProductionOrderLineCategorySelection"("productionOrderLineId", "productCategoryId");
CREATE INDEX IF NOT EXISTS "ProductionOrderLineCategorySelection_organizationId_productionOrderLineId_idx"
  ON "ProductionOrderLineCategorySelection"("organizationId", "productionOrderLineId");

ALTER TABLE "ProductionOrderLineCategorySelection" DROP CONSTRAINT IF EXISTS "ProductionOrderLineCategorySelection_organizationId_fkey";
ALTER TABLE "ProductionOrderLineCategorySelection"
  ADD CONSTRAINT "ProductionOrderLineCategorySelection_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderLineCategorySelection" DROP CONSTRAINT IF EXISTS "ProductionOrderLineCategorySelection_productionOrderLineId_fkey";
ALTER TABLE "ProductionOrderLineCategorySelection"
  ADD CONSTRAINT "ProductionOrderLineCategorySelection_productionOrderLineId_fkey"
  FOREIGN KEY ("productionOrderLineId") REFERENCES "ProductionOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderLineCategorySelection" DROP CONSTRAINT IF EXISTS "ProductionOrderLineCategorySelection_productCategoryId_fkey";
ALTER TABLE "ProductionOrderLineCategorySelection"
  ADD CONSTRAINT "ProductionOrderLineCategorySelection_productCategoryId_fkey"
  FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProductionOrderLineCategoryOption" (
  "id" TEXT NOT NULL,
  "selectionId" TEXT NOT NULL,
  "categoryOptionId" TEXT NOT NULL,
  CONSTRAINT "ProductionOrderLineCategoryOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrderLineCategoryOption_selectionId_categoryOptionId_key"
  ON "ProductionOrderLineCategoryOption"("selectionId", "categoryOptionId");
CREATE INDEX IF NOT EXISTS "ProductionOrderLineCategoryOption_categoryOptionId_idx"
  ON "ProductionOrderLineCategoryOption"("categoryOptionId");

ALTER TABLE "ProductionOrderLineCategoryOption" DROP CONSTRAINT IF EXISTS "ProductionOrderLineCategoryOption_selectionId_fkey";
ALTER TABLE "ProductionOrderLineCategoryOption"
  ADD CONSTRAINT "ProductionOrderLineCategoryOption_selectionId_fkey"
  FOREIGN KEY ("selectionId") REFERENCES "ProductionOrderLineCategorySelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderLineCategoryOption" DROP CONSTRAINT IF EXISTS "ProductionOrderLineCategoryOption_categoryOptionId_fkey";
ALTER TABLE "ProductionOrderLineCategoryOption"
  ADD CONSTRAINT "ProductionOrderLineCategoryOption_categoryOptionId_fkey"
  FOREIGN KEY ("categoryOptionId") REFERENCES "ProductCategoryOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) Backfill old single line category into a selection (OPEN_TEXT name snapshot via option if needed)
-- Convert legacy categories referenced by lines into DROPDOWN SINGLE with one synthetic option, then select it.
INSERT INTO "ProductCategoryOption" ("id", "organizationId", "productCategoryId", "code", "name", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
  'pcopt_legacy_' || pc.id,
  pc."organizationId",
  pc.id,
  pc.code,
  pc.name,
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProductCategory" pc
WHERE EXISTS (SELECT 1 FROM "ProductionOrderLine" ol WHERE ol."productCategoryId" = pc.id)
  AND NOT EXISTS (
    SELECT 1 FROM "ProductCategoryOption" o WHERE o."productCategoryId" = pc.id AND o.code = pc.code
  );

UPDATE "ProductCategory" pc
SET "inputType" = 'DROPDOWN',
    "choiceMode" = 'SINGLE'
WHERE EXISTS (SELECT 1 FROM "ProductionOrderLine" ol WHERE ol."productCategoryId" = pc.id);

INSERT INTO "ProductionOrderLineCategorySelection" (
  "id", "organizationId", "productionOrderLineId", "productCategoryId", "textValue", "createdAt"
)
SELECT
  'polcs_' || ol.id,
  ol."organizationId",
  ol.id,
  ol."productCategoryId",
  NULL,
  CURRENT_TIMESTAMP
FROM "ProductionOrderLine" ol
WHERE ol."productCategoryId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ProductionOrderLineCategorySelection" s WHERE s."productionOrderLineId" = ol.id
  );

INSERT INTO "ProductionOrderLineCategoryOption" ("id", "selectionId", "categoryOptionId")
SELECT
  'polco_' || ol.id,
  'polcs_' || ol.id,
  COALESCE(
    (SELECT o.id FROM "ProductCategoryOption" o WHERE o."productCategoryId" = ol."productCategoryId" AND o.code = (
      SELECT pc.code FROM "ProductCategory" pc WHERE pc.id = ol."productCategoryId"
    ) LIMIT 1),
    'pcopt_legacy_' || ol."productCategoryId"
  )
FROM "ProductionOrderLine" ol
WHERE ol."productCategoryId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ProductionOrderLineCategoryOption" x WHERE x."selectionId" = 'polcs_' || ol.id
  );

-- 6) Drop legacy required category on order lines
DROP INDEX IF EXISTS "ProductionOrderLine_productionOrderId_productId_productCategoryId_key";
DROP INDEX IF EXISTS "ProductionOrderLine_organizationId_productCategoryId_idx";

ALTER TABLE "ProductionOrderLine" DROP CONSTRAINT IF EXISTS "ProductionOrderLine_productCategoryId_fkey";
ALTER TABLE "ProductionOrderLine" DROP COLUMN IF EXISTS "productCategoryId";

-- 7) Materials
CREATE TABLE IF NOT EXISTS "ProductionOrderLineMaterial" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productionOrderLineId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantityPerUnit" INTEGER NOT NULL,
  "quantityReceived" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionOrderLineMaterial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductionOrderLineMaterial_organizationId_productionOrderLineId_idx"
  ON "ProductionOrderLineMaterial"("organizationId", "productionOrderLineId");

ALTER TABLE "ProductionOrderLineMaterial" DROP CONSTRAINT IF EXISTS "ProductionOrderLineMaterial_organizationId_fkey";
ALTER TABLE "ProductionOrderLineMaterial"
  ADD CONSTRAINT "ProductionOrderLineMaterial_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderLineMaterial" DROP CONSTRAINT IF EXISTS "ProductionOrderLineMaterial_productionOrderLineId_fkey";
ALTER TABLE "ProductionOrderLineMaterial"
  ADD CONSTRAINT "ProductionOrderLineMaterial_productionOrderLineId_fkey"
  FOREIGN KEY ("productionOrderLineId") REFERENCES "ProductionOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ProductionOrderLineMaterialStage" (
  "id" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "orderProcessId" TEXT NOT NULL,
  CONSTRAINT "ProductionOrderLineMaterialStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrderLineMaterialStage_materialId_orderProcessId_key"
  ON "ProductionOrderLineMaterialStage"("materialId", "orderProcessId");
CREATE INDEX IF NOT EXISTS "ProductionOrderLineMaterialStage_orderProcessId_idx"
  ON "ProductionOrderLineMaterialStage"("orderProcessId");

ALTER TABLE "ProductionOrderLineMaterialStage" DROP CONSTRAINT IF EXISTS "ProductionOrderLineMaterialStage_materialId_fkey";
ALTER TABLE "ProductionOrderLineMaterialStage"
  ADD CONSTRAINT "ProductionOrderLineMaterialStage_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "ProductionOrderLineMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderLineMaterialStage" DROP CONSTRAINT IF EXISTS "ProductionOrderLineMaterialStage_orderProcessId_fkey";
ALTER TABLE "ProductionOrderLineMaterialStage"
  ADD CONSTRAINT "ProductionOrderLineMaterialStage_orderProcessId_fkey"
  FOREIGN KEY ("orderProcessId") REFERENCES "ProductionOrderProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
