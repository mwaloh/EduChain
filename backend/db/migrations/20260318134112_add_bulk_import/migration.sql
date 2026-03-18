-- CreateTable
CREATE TABLE "BulkImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "institutionAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER NOT NULL,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "CredentialAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "studentAddress" TEXT NOT NULL,
    "institutionAddress" TEXT NOT NULL,
    "metadata" TEXT,
    "transactionHash" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "BulkImportJob_jobId_key" ON "BulkImportJob"("jobId");

-- CreateIndex
CREATE INDEX "BulkImportJob_jobId_idx" ON "BulkImportJob"("jobId");

-- CreateIndex
CREATE INDEX "BulkImportJob_institutionAddress_idx" ON "BulkImportJob"("institutionAddress");

-- CreateIndex
CREATE INDEX "BulkImportJob_status_idx" ON "BulkImportJob"("status");

-- CreateIndex
CREATE INDEX "BulkImportJob_createdAt_idx" ON "BulkImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "CredentialAudit_action_idx" ON "CredentialAudit"("action");

-- CreateIndex
CREATE INDEX "CredentialAudit_studentAddress_idx" ON "CredentialAudit"("studentAddress");

-- CreateIndex
CREATE INDEX "CredentialAudit_institutionAddress_idx" ON "CredentialAudit"("institutionAddress");

-- CreateIndex
CREATE INDEX "CredentialAudit_createdAt_idx" ON "CredentialAudit"("createdAt");
