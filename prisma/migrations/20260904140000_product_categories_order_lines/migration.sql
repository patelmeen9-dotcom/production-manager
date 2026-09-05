-- Additive: product categories, product details, multi-line orders with per-line process snapshots.
-- Preserves existing organizations, users, orders, and production history.

-- 1) Product optional details
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "details" TEXT;

-- 2) ProductCategory master
CREATE TABLE IF NOT EXISTS "ProductCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_organizationId_code_key"
  ON "ProductCategory"("organizationId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_organizationId_name_key"
  ON "ProductCategory"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "ProductCategory_organizationId_isActive_idx"
  ON "ProductCategory"("organizationId", "isActive");

ALTER TABLE "ProductCategory"
  DROP CONSTRAINT IF EXISTS "ProductCategory_organizationId_fkey";
ALTER TABLE "ProductCategory"
  ADD CONSTRAINT "ProductCategory_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3) Product ↔ Category many-to-many
CREATE TABLE IF NOT EXISTS "ProductCategoryAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductCategoryAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategoryAssignment_productId_productCategoryId_key"
  ON "ProductCategoryAssignment"("productId", "productCategoryId");
CREATE INDEX IF NOT EXISTS "ProductCategoryAssignment_organizationId_productId_idx"
  ON "ProductCategoryAssignment"("organizationId", "productId");
CREATE INDEX IF NOT EXISTS "ProductCategoryAssignment_organizationId_productCategoryId_idx"
  ON "ProductCategoryAssignment"("organizationId", "productCategoryId");

ALTER TABLE "ProductCategoryAssignment"
  DROP CONSTRAINT IF EXISTS "ProductCategoryAssignment_organizationId_fkey";
ALTER TABLE "ProductCategoryAssignment"
  ADD CONSTRAINT "ProductCategoryAssignment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductCategoryAssignment"
  DROP CONSTRAINT IF EXISTS "ProductCategoryAssignment_productId_fkey";
ALTER TABLE "ProductCategoryAssignment"
  ADD CONSTRAINT "ProductCategoryAssignment_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductCategoryAssignment"
  DROP CONSTRAINT IF EXISTS "ProductCategoryAssignment_productCategoryId_fkey";
ALTER TABLE "ProductCategoryAssignment"
  ADD CONSTRAINT "ProductCategoryAssignment_productCategoryId_fkey"
  FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Order lines
CREATE TABLE IF NOT EXISTS "ProductionOrderLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productCategoryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrderLine_productionOrderId_lineNumber_key"
  ON "ProductionOrderLine"("productionOrderId", "lineNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrderLine_productionOrderId_productId_productCategoryId_key"
  ON "ProductionOrderLine"("productionOrderId", "productId", "productCategoryId");
CREATE INDEX IF NOT EXISTS "ProductionOrderLine_organizationId_productionOrderId_idx"
  ON "ProductionOrderLine"("organizationId", "productionOrderId");
CREATE INDEX IF NOT EXISTS "ProductionOrderLine_organizationId_productId_idx"
  ON "ProductionOrderLine"("organizationId", "productId");
CREATE INDEX IF NOT EXISTS "ProductionOrderLine_organizationId_productCategoryId_idx"
  ON "ProductionOrderLine"("organizationId", "productCategoryId");

ALTER TABLE "ProductionOrderLine"
  DROP CONSTRAINT IF EXISTS "ProductionOrderLine_organizationId_fkey";
ALTER TABLE "ProductionOrderLine"
  ADD CONSTRAINT "ProductionOrderLine_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderLine"
  DROP CONSTRAINT IF EXISTS "ProductionOrderLine_productionOrderId_fkey";
ALTER TABLE "ProductionOrderLine"
  ADD CONSTRAINT "ProductionOrderLine_productionOrderId_fkey"
  FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderLine"
  DROP CONSTRAINT IF EXISTS "ProductionOrderLine_productId_fkey";
ALTER TABLE "ProductionOrderLine"
  ADD CONSTRAINT "ProductionOrderLine_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- productCategoryId FK added after backfill categories exist
ALTER TABLE "ProductionOrderLine"
  DROP CONSTRAINT IF EXISTS "ProductionOrderLine_productCategoryId_fkey";

-- 5) Link process snapshot rows to order lines (nullable during backfill)
ALTER TABLE "ProductionOrderProcess"
  ADD COLUMN IF NOT EXISTS "productionOrderLineId" TEXT;

-- 6) Backfill: one GENERAL category per org that has orders (or any org with products)
INSERT INTO "ProductCategory" ("id", "organizationId", "code", "name", "isActive", "createdAt", "updatedAt")
SELECT
  'pcat_general_' || o.id,
  o.id,
  'GENERAL',
  'General',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductCategory" pc
  WHERE pc."organizationId" = o.id AND pc.code = 'GENERAL'
);

-- Ensure every org that owns an order has GENERAL (covers empty-product orgs with legacy orders)
INSERT INTO "ProductCategory" ("id", "organizationId", "code", "name", "isActive", "createdAt", "updatedAt")
SELECT DISTINCT
  'pcat_general_' || po."organizationId",
  po."organizationId",
  'GENERAL',
  'General',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProductionOrder" po
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductCategory" pc
  WHERE pc."organizationId" = po."organizationId" AND pc.code = 'GENERAL'
);

-- Backfill one order line per existing order (idempotent)
INSERT INTO "ProductionOrderLine" (
  "id", "organizationId", "productionOrderId", "productId", "productCategoryId", "quantity", "lineNumber", "createdAt"
)
SELECT
  'poline_' || po.id,
  po."organizationId",
  po.id,
  po."productId",
  pc.id,
  po.quantity,
  1,
  CURRENT_TIMESTAMP
FROM "ProductionOrder" po
INNER JOIN "ProductCategory" pc
  ON pc."organizationId" = po."organizationId" AND pc.code = 'GENERAL'
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductionOrderLine" ol WHERE ol."productionOrderId" = po.id
);

-- Attach existing process snapshot rows to the backfilled line
UPDATE "ProductionOrderProcess" pop
SET "productionOrderLineId" = ol.id
FROM "ProductionOrderLine" ol
WHERE ol."productionOrderId" = pop."productionOrderId"
  AND ol."lineNumber" = 1
  AND pop."productionOrderLineId" IS NULL;

-- Fail loudly if any process row remains unlinked (should not happen)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProductionOrderProcess" WHERE "productionOrderLineId" IS NULL) THEN
    RAISE EXCEPTION 'Migration failed: ProductionOrderProcess rows without productionOrderLineId remain';
  END IF;
END $$;

-- 7) Enforce NOT NULL + FKs + unique index swap on process snapshot
ALTER TABLE "ProductionOrderProcess"
  ALTER COLUMN "productionOrderLineId" SET NOT NULL;

ALTER TABLE "ProductionOrderLine"
  ADD CONSTRAINT "ProductionOrderLine_productCategoryId_fkey"
  FOREIGN KEY ("productCategoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderProcess"
  DROP CONSTRAINT IF EXISTS "ProductionOrderProcess_productionOrderLineId_fkey";
ALTER TABLE "ProductionOrderProcess"
  ADD CONSTRAINT "ProductionOrderProcess_productionOrderLineId_fkey"
  FOREIGN KEY ("productionOrderLineId") REFERENCES "ProductionOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ProductionOrderProcess_productionOrderId_sequence_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrderProcess_productionOrderLineId_sequence_key"
  ON "ProductionOrderProcess"("productionOrderLineId", "sequence");
CREATE INDEX IF NOT EXISTS "ProductionOrderProcess_organizationId_productionOrderLineId_idx"
  ON "ProductionOrderProcess"("organizationId", "productionOrderLineId");
