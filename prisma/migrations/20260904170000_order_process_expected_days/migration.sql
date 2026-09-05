-- Additive: optional expected days per order process snapshot stage.
ALTER TABLE "ProductionOrderProcess" ADD COLUMN IF NOT EXISTS "expectedDays" INTEGER;
