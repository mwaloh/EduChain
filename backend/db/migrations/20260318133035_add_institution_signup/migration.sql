-- CreateTable
CREATE TABLE "InstitutionSignup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionName" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionSignup_adminEmail_key" ON "InstitutionSignup"("adminEmail");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionSignup_verificationToken_key" ON "InstitutionSignup"("verificationToken");

-- CreateIndex
CREATE INDEX "InstitutionSignup_adminEmail_idx" ON "InstitutionSignup"("adminEmail");

-- CreateIndex
CREATE INDEX "InstitutionSignup_verificationToken_idx" ON "InstitutionSignup"("verificationToken");

-- CreateIndex
CREATE INDEX "InstitutionSignup_status_idx" ON "InstitutionSignup"("status");
