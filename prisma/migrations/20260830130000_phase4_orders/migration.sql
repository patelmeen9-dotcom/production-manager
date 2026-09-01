CREATE TYPE "OrderLifecycleStatus" AS ENUM ('NOT_STARTED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED', 'ON_HOLD');
CREATE TYPE "DateInputType" AS ENUM ('FIXED_DATE', 'DAYS_FROM_ORDER', 'NONE');
CREATE TYPE "OrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "orderDate" DATE NOT NULL,
    "startDateType" "DateInputType" NOT NULL DEFAULT 'NONE',
    "startDate" DATE,
    "startDays" INTEGER,
    "effectiveStartDate" DATE NOT NULL,
    "dueDateType" "DateInputType" NOT NULL,
    "dueDate" DATE,
    "dueDays" INTEGER,
    "resolvedDueDate" DATE NOT NULL,
    "priority" "OrderPriority" NOT NULL DEFAULT 'NORMAL',
    "remarks" TEXT,
    "lifecycleStatus" "OrderLifecycleStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductionOrderProcess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "processId" TEXT,
    "processName" TEXT NOT NULL,
    "processCode" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "plannedQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionOrderProcess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductionOrder_organizationId_orderNumber_key" ON "ProductionOrder"("organizationId", "orderNumber");
CREATE INDEX "ProductionOrder_organizationId_plantId_orderDate_idx" ON "ProductionOrder"("organizationId", "plantId", "orderDate");
CREATE INDEX "ProductionOrder_organizationId_clientId_idx" ON "ProductionOrder"("organizationId", "clientId");
CREATE INDEX "ProductionOrder_organizationId_lifecycleStatus_idx" ON "ProductionOrder"("organizationId", "lifecycleStatus");
CREATE INDEX "ProductionOrder_organizationId_effectiveStartDate_idx" ON "ProductionOrder"("organizationId", "effectiveStartDate");
CREATE INDEX "ProductionOrder_organizationId_resolvedDueDate_idx" ON "ProductionOrder"("organizationId", "resolvedDueDate");
CREATE UNIQUE INDEX "ProductionOrderProcess_productionOrderId_sequence_key" ON "ProductionOrderProcess"("productionOrderId", "sequence");
CREATE INDEX "ProductionOrderProcess_organizationId_productionOrderId_idx" ON "ProductionOrderProcess"("organizationId", "productionOrderId");

ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrderProcess" ADD CONSTRAINT "ProductionOrderProcess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrderProcess" ADD CONSTRAINT "ProductionOrderProcess_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionOrderProcess" ADD CONSTRAINT "ProductionOrderProcess_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;
