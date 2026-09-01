CREATE TABLE "ProductionEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "orderProcessId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialActivityEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "specialActivityId" TEXT NOT NULL,
    "orderProcessId" TEXT,
    "entryDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialActivityEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pe_org_order_process_idx" ON "ProductionEntry"("organizationId", "productionOrderId", "orderProcessId");
CREATE INDEX "pe_org_plant_date_idx" ON "ProductionEntry"("organizationId", "plantId", "entryDate");
CREATE INDEX "pe_org_date_idx" ON "ProductionEntry"("organizationId", "entryDate");
CREATE INDEX "pe_org_created_idx" ON "ProductionEntry"("organizationId", "createdAt");
CREATE INDEX "SpecialActivityEntry_organizationId_productionOrderId_idx" ON "SpecialActivityEntry"("organizationId", "productionOrderId");
CREATE INDEX "SpecialActivityEntry_organizationId_plantId_entryDate_idx" ON "SpecialActivityEntry"("organizationId", "plantId", "entryDate");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "AuditLog_organizationId_entityType_entityId_idx" ON "AuditLog"("organizationId", "entityType", "entityId");

ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_orderProcessId_fkey" FOREIGN KEY ("orderProcessId") REFERENCES "ProductionOrderProcess"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionEntry" ADD CONSTRAINT "ProductionEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialActivityEntry" ADD CONSTRAINT "SpecialActivityEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialActivityEntry" ADD CONSTRAINT "SpecialActivityEntry_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialActivityEntry" ADD CONSTRAINT "SpecialActivityEntry_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialActivityEntry" ADD CONSTRAINT "SpecialActivityEntry_specialActivityId_fkey" FOREIGN KEY ("specialActivityId") REFERENCES "SpecialActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialActivityEntry" ADD CONSTRAINT "SpecialActivityEntry_orderProcessId_fkey" FOREIGN KEY ("orderProcessId") REFERENCES "ProductionOrderProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpecialActivityEntry" ADD CONSTRAINT "SpecialActivityEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
