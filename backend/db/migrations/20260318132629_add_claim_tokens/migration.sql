-- CreateTable
CREATE TABLE "ClaimToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentName" TEXT,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" DATETIME,
    "claimedBy" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClaimToken_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ClaimToken_token_key" ON "ClaimToken"("token");

-- CreateIndex
CREATE INDEX "ClaimToken_token_idx" ON "ClaimToken"("token");

-- CreateIndex
CREATE INDEX "ClaimToken_studentEmail_idx" ON "ClaimToken"("studentEmail");

-- CreateIndex
CREATE INDEX "ClaimToken_claimed_idx" ON "ClaimToken"("claimed");

-- CreateIndex
CREATE INDEX "ClaimToken_expiresAt_idx" ON "ClaimToken"("expiresAt");
