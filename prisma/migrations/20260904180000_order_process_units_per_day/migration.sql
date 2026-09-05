-- Planned daily throughput per order process stage (optional).
ALTER TABLE "ProductionOrderProcess" ADD COLUMN IF NOT EXISTS "unitsPerDay" INTEGER;
