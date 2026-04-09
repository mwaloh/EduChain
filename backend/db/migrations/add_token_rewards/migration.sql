-- CreateTable TokenReward
CREATE TABLE "TokenReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientAddress" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "transactionHash" TEXT,
    "credentialId" TEXT,
    "verificationLogId" TEXT,
    "metadata" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME
);

-- CreateTable RewardLog
CREATE TABLE "RewardLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalRewardsDistributed" DECIMAL(20,2) NOT NULL,
    "credentialsIssuedCount" INTEGER NOT NULL DEFAULT 0,
    "verificationsCount" INTEGER NOT NULL DEFAULT 0,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "TokenReward_recipientAddress_idx" ON "TokenReward"("recipientAddress");

-- CreateIndex
CREATE INDEX "TokenReward_reason_idx" ON "TokenReward"("reason");

-- CreateIndex
CREATE INDEX "TokenReward_status_idx" ON "TokenReward"("status");

-- CreateIndex
CREATE INDEX "TokenReward_credentialId_idx" ON "TokenReward"("credentialId");

-- CreateIndex
CREATE INDEX "TokenReward_verificationLogId_idx" ON "TokenReward"("verificationLogId");

-- CreateIndex
CREATE INDEX "TokenReward_createdAt_idx" ON "TokenReward"("createdAt");

-- CreateIndex
CREATE INDEX "RewardLog_periodStart_idx" ON "RewardLog"("periodStart");

-- CreateIndex
CREATE INDEX "RewardLog_createdAt_idx" ON "RewardLog"("createdAt");
