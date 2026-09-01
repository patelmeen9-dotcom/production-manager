-- Additive schema for due-date-from-start and order-requested special activities.
-- Safe for existing Neon data: new enum value, nullable columns, new table.

ALTER TYPE "DateInputType" ADD VALUE IF NOT EXISTS 'DAYS_FROM_START';

ALTER TABLE "ProductionOrder"
  ADD COLUMN IF NOT EXISTS "specialActivitiesRequested" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ProductionOrderSpecialActivity" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "productionOrderId" TEXT NOT NULL,
  "specialActivityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionOrderSpecialActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrderSpecialActivity_productionOrderId_specialActivityId_key"
  ON "ProductionOrderSpecialActivity"("productionOrderId", "specialActivityId");

CREATE INDEX IF NOT EXISTS "ProductionOrderSpecialActivity_organizationId_productionOrderId_idx"
  ON "ProductionOrderSpecialActivity"("organizationId", "productionOrderId");

ALTER TABLE "ProductionOrderSpecialActivity"
  DROP CONSTRAINT IF EXISTS "ProductionOrderSpecialActivity_organizationId_fkey";
ALTER TABLE "ProductionOrderSpecialActivity"
  ADD CONSTRAINT "ProductionOrderSpecialActivity_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderSpecialActivity"
  DROP CONSTRAINT IF EXISTS "ProductionOrderSpecialActivity_productionOrderId_fkey";
ALTER TABLE "ProductionOrderSpecialActivity"
  ADD CONSTRAINT "ProductionOrderSpecialActivity_productionOrderId_fkey"
  FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductionOrderSpecialActivity"
  DROP CONSTRAINT IF EXISTS "ProductionOrderSpecialActivity_specialActivityId_fkey";
ALTER TABLE "ProductionOrderSpecialActivity"
  ADD CONSTRAINT "ProductionOrderSpecialActivity_specialActivityId_fkey"
  FOREIGN KEY ("specialActivityId") REFERENCES "SpecialActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionEntry"
  ADD COLUMN IF NOT EXISTS "specialActivityId" TEXT;

CREATE INDEX IF NOT EXISTS "ProductionEntry_organizationId_specialActivityId_idx"
  ON "ProductionEntry"("organizationId", "specialActivityId");

ALTER TABLE "ProductionEntry"
  DROP CONSTRAINT IF EXISTS "ProductionEntry_specialActivityId_fkey";
ALTER TABLE "ProductionEntry"
  ADD CONSTRAINT "ProductionEntry_specialActivityId_fkey"
  FOREIGN KEY ("specialActivityId") REFERENCES "SpecialActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
