-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPlantAccess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPlantAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plant_organizationId_name_key" ON "Plant"("organizationId", "name");
CREATE INDEX "Plant_organizationId_isActive_idx" ON "Plant"("organizationId", "isActive");
CREATE UNIQUE INDEX "UserPlantAccess_userId_plantId_key" ON "UserPlantAccess"("userId", "plantId");
CREATE INDEX "UserPlantAccess_organizationId_userId_idx" ON "UserPlantAccess"("organizationId", "userId");
CREATE INDEX "UserPlantAccess_organizationId_plantId_idx" ON "UserPlantAccess"("organizationId", "plantId");

ALTER TABLE "Plant" ADD CONSTRAINT "Plant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserPlantAccess" ADD CONSTRAINT "UserPlantAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserPlantAccess" ADD CONSTRAINT "UserPlantAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPlantAccess" ADD CONSTRAINT "UserPlantAccess_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
