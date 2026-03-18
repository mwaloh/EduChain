-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metadataURI" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" BIGINT NOT NULL,
    "studentAddress" TEXT NOT NULL,
    "studentHash" TEXT NOT NULL,
    "ipfsCid" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "issuedOn" DATETIME NOT NULL,
    "expiresOn" DATETIME,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revocationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Credential_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "verifierAddress" TEXT NOT NULL,
    "tokenId" BIGINT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "blockchainTxHash" TEXT,
    CONSTRAINT "VerificationLog_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VerificationLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "totalCredentials" BIGINT NOT NULL DEFAULT 0,
    "totalVerifications" BIGINT NOT NULL DEFAULT 0,
    "revokedCount" BIGINT NOT NULL DEFAULT 0,
    "expiredCount" BIGINT NOT NULL DEFAULT 0,
    "newInstitutions" BIGINT NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FraudAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenId" BIGINT NOT NULL,
    "verifierAddress" TEXT NOT NULL,
    "attemptedStatus" TEXT NOT NULL,
    "actualStatus" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_address_key" ON "Institution"("address");

-- CreateIndex
CREATE INDEX "Institution_address_idx" ON "Institution"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Credential_tokenId_key" ON "Credential"("tokenId");

-- CreateIndex
CREATE INDEX "Credential_tokenId_idx" ON "Credential"("tokenId");

-- CreateIndex
CREATE INDEX "Credential_studentAddress_idx" ON "Credential"("studentAddress");

-- CreateIndex
CREATE INDEX "Credential_institutionId_idx" ON "Credential"("institutionId");

-- CreateIndex
CREATE INDEX "VerificationLog_verifierAddress_idx" ON "VerificationLog"("verifierAddress");

-- CreateIndex
CREATE INDEX "VerificationLog_tokenId_idx" ON "VerificationLog"("tokenId");

-- CreateIndex
CREATE INDEX "VerificationLog_timestamp_idx" ON "VerificationLog"("timestamp");

-- CreateIndex
CREATE INDEX "VerificationLog_status_idx" ON "VerificationLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Analytics_date_key" ON "Analytics"("date");

-- CreateIndex
CREATE INDEX "Analytics_date_idx" ON "Analytics"("date");

-- CreateIndex
CREATE INDEX "FraudAttempt_tokenId_idx" ON "FraudAttempt"("tokenId");

-- CreateIndex
CREATE INDEX "FraudAttempt_timestamp_idx" ON "FraudAttempt"("timestamp");
