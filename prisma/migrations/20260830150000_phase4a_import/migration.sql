-- AlterTable Plant: add stable PlantCode
ALTER TABLE "Plant" ADD COLUMN "code" TEXT;

UPDATE "Plant" SET "code" = UPPER(REGEXP_REPLACE(COALESCE("name", 'PLANT'), '[^A-Za-z0-9]+', '-', 'g'))
WHERE "code" IS NULL;

ALTER TABLE "Plant" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Plant_organizationId_code_key" ON "Plant"("organizationId", "code");

-- AlterTable Client: add stable ClientCode
ALTER TABLE "Client" ADD COLUMN "code" TEXT;

UPDATE "Client" SET "code" = UPPER(REGEXP_REPLACE(COALESCE("name", 'CLIENT'), '[^A-Za-z0-9]+', '-', 'g'))
WHERE "code" IS NULL;

ALTER TABLE "Client" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Client_organizationId_code_key" ON "Client"("organizationId", "code");

CREATE TYPE "ImportJobStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'VALIDATION_FAILED', 'COMMITTED', 'FAILED', 'CANCELLED');
CREATE TYPE "ImportDuplicateStrategy" AS ENUM ('CREATE_OR_UPDATE', 'SKIP_EXISTING', 'FAIL_ON_DUPLICATE');

CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importType" TEXT NOT NULL DEFAULT 'FULL_WORKBOOK',
    "duplicateStrategy" "ImportDuplicateStrategy" NOT NULL DEFAULT 'CREATE_OR_UPDATE',
    "status" "ImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successfulRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "previewPayload" JSONB,
    "summary" JSONB,
    "errorReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportJob_organizationId_createdAt_idx" ON "ImportJob"("organizationId", "createdAt");
CREATE INDEX "ImportJob_organizationId_status_idx" ON "ImportJob"("organizationId", "status");

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
