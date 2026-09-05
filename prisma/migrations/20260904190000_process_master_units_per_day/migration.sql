-- Units/day belongs on Process master, not on the order process snapshot.
ALTER TABLE "Process" ADD COLUMN IF NOT EXISTS "unitsPerDay" INTEGER;
ALTER TABLE "ProductionOrderProcess" DROP COLUMN IF EXISTS "unitsPerDay";
