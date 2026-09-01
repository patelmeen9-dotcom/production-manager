-- Phase 11: supporting indexes for org/plant scoped list pages and date-ordered entry history.
-- Safe for existing data: additive indexes only; no table rewrites of application data.

CREATE INDEX IF NOT EXISTS "ProductionOrder_org_plant_created_idx"
  ON "ProductionOrder" ("organizationId", "plantId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ProductionEntry_org_date_created_idx"
  ON "ProductionEntry" ("organizationId", "entryDate" DESC, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AuditLog_org_created_idx"
  ON "AuditLog" ("organizationId", "createdAt" DESC);
