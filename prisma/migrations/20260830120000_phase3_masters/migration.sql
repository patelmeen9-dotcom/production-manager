-- CreateEnum
CREATE TYPE "SpecialActivityType" AS ENUM ('SPECIAL_PROCESS', 'REWORK', 'OTHER');

CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlantProductProcessMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantProductProcessMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "activityType" "SpecialActivityType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_organizationId_name_key" ON "Client"("organizationId", "name");
CREATE INDEX "Client_organizationId_isActive_idx" ON "Client"("organizationId", "isActive");
CREATE UNIQUE INDEX "Product_organizationId_code_key" ON "Product"("organizationId", "code");
CREATE UNIQUE INDEX "Product_organizationId_name_key" ON "Product"("organizationId", "name");
CREATE INDEX "Product_organizationId_isActive_idx" ON "Product"("organizationId", "isActive");
CREATE UNIQUE INDEX "Process_organizationId_code_key" ON "Process"("organizationId", "code");
CREATE UNIQUE INDEX "Process_organizationId_name_key" ON "Process"("organizationId", "name");
CREATE INDEX "Process_organizationId_isActive_idx" ON "Process"("organizationId", "isActive");
CREATE UNIQUE INDEX "pppm_org_plant_product_process_key" ON "PlantProductProcessMapping"("organizationId", "plantId", "productId", "processId");
CREATE UNIQUE INDEX "pppm_org_plant_product_seq_key" ON "PlantProductProcessMapping"("organizationId", "plantId", "productId", "sequence");
CREATE INDEX "pppm_org_plant_product_idx" ON "PlantProductProcessMapping"("organizationId", "plantId", "productId");
CREATE INDEX "pppm_org_plant_active_idx" ON "PlantProductProcessMapping"("organizationId", "plantId", "isActive");
CREATE UNIQUE INDEX "SpecialActivity_organizationId_code_key" ON "SpecialActivity"("organizationId", "code");
CREATE UNIQUE INDEX "SpecialActivity_organizationId_name_key" ON "SpecialActivity"("organizationId", "name");
CREATE INDEX "SpecialActivity_organizationId_isActive_idx" ON "SpecialActivity"("organizationId", "isActive");

ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Process" ADD CONSTRAINT "Process_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlantProductProcessMapping" ADD CONSTRAINT "PlantProductProcessMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlantProductProcessMapping" ADD CONSTRAINT "PlantProductProcessMapping_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlantProductProcessMapping" ADD CONSTRAINT "PlantProductProcessMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlantProductProcessMapping" ADD CONSTRAINT "PlantProductProcessMapping_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SpecialActivity" ADD CONSTRAINT "SpecialActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
