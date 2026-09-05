-- Additive: optional remarks on each production order line.
ALTER TABLE "ProductionOrderLine" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
