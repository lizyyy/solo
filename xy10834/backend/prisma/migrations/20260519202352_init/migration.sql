-- CreateTable
CREATE TABLE "ConfigItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT
);

-- CreateTable
CREATE TABLE "ServiceInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "hostname" TEXT,
    "env" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "lastHeartbeat" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DistributionVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "releasedBy" TEXT,
    "releaseNote" TEXT,
    "isForce" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DistributionVersion_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ConfigItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PullRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "distributionId" TEXT,
    "requestedVersion" INTEGER NOT NULL,
    "actualVersion" INTEGER,
    "pullStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "pulledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetryAt" DATETIME,
    CONSTRAINT "PullRecord_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ConfigItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PullRecord_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ServiceInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PullRecord_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "DistributionVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EffectiveState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL,
    "effectiveStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConfirmedAt" DATETIME,
    "compensatedAt" DATETIME,
    "compensateStatus" TEXT NOT NULL DEFAULT 'NOT_NEEDED',
    "compensateNote" TEXT,
    "pullRecordId" TEXT,
    CONSTRAINT "EffectiveState_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ConfigItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EffectiveState_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ServiceInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EffectiveState_pullRecordId_fkey" FOREIGN KEY ("pullRecordId") REFERENCES "PullRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiffReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "baseVersion" INTEGER NOT NULL,
    "targetVersion" INTEGER NOT NULL,
    "diffContent" TEXT NOT NULL,
    "affectedInstances" INTEGER NOT NULL,
    "generatedBy" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedAt" DATETIME,
    CONSTRAINT "DiffReport_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ConfigItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestKey" TEXT NOT NULL,
    "lockedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedBy" TEXT,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ConfigItem_status_idx" ON "ConfigItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigItem_key_version_key" ON "ConfigItem"("key", "version");

-- CreateIndex
CREATE INDEX "ServiceInstance_serviceName_env_idx" ON "ServiceInstance"("serviceName", "env");

-- CreateIndex
CREATE INDEX "ServiceInstance_status_idx" ON "ServiceInstance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceInstance_instanceId_env_key" ON "ServiceInstance"("instanceId", "env");

-- CreateIndex
CREATE INDEX "DistributionVersion_releasedAt_idx" ON "DistributionVersion"("releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionVersion_configId_version_key" ON "DistributionVersion"("configId", "version");

-- CreateIndex
CREATE INDEX "PullRecord_configId_pullStatus_idx" ON "PullRecord"("configId", "pullStatus");

-- CreateIndex
CREATE INDEX "PullRecord_instanceId_pulledAt_idx" ON "PullRecord"("instanceId", "pulledAt");

-- CreateIndex
CREATE INDEX "PullRecord_pullStatus_nextRetryAt_idx" ON "PullRecord"("pullStatus", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "EffectiveState_pullRecordId_key" ON "EffectiveState"("pullRecordId");

-- CreateIndex
CREATE INDEX "EffectiveState_effectiveStatus_idx" ON "EffectiveState"("effectiveStatus");

-- CreateIndex
CREATE INDEX "EffectiveState_compensateStatus_idx" ON "EffectiveState"("compensateStatus");

-- CreateIndex
CREATE UNIQUE INDEX "EffectiveState_configId_instanceId_key" ON "EffectiveState"("configId", "instanceId");

-- CreateIndex
CREATE INDEX "DiffReport_configId_generatedAt_idx" ON "DiffReport"("configId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequestLock_requestKey_key" ON "RequestLock"("requestKey");

-- CreateIndex
CREATE INDEX "RequestLock_expiresAt_idx" ON "RequestLock"("expiresAt");
