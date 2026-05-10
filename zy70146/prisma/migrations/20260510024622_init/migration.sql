-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "services_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "api_endpoints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "api_endpoints_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "slo_configurations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT,
    "endpointId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetValue" REAL NOT NULL,
    "timeWindowType" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "slo_configurations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "slo_configurations_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "slo_configurations_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "api_endpoints" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "error_samples" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT,
    "endpointId" TEXT,
    "source" TEXT NOT NULL,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "statusCode" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "requestId" TEXT,
    "userId" TEXT,
    "metadata" TEXT,
    "isDeducted" BOOLEAN NOT NULL DEFAULT false,
    "deductedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "error_samples_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "error_samples_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "error_samples_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "api_endpoints" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "time_window_budgets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "sloConfigId" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "windowType" TEXT NOT NULL,
    "totalBudget" REAL NOT NULL,
    "usedBudget" REAL NOT NULL DEFAULT 0,
    "remainingBudget" REAL NOT NULL,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "frozenAt" DATETIME,
    "frozenReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "time_window_budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "time_window_budgets_sloConfigId_fkey" FOREIGN KEY ("sloConfigId") REFERENCES "slo_configurations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "budget_deductions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "errorSampleId" TEXT NOT NULL,
    "deductedAmount" REAL NOT NULL,
    "reason" TEXT,
    "deductedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "budget_deductions_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "time_window_budgets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "budget_deductions_errorSampleId_fkey" FOREIGN KEY ("errorSampleId") REFERENCES "error_samples" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "budget_freezes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "frozenBy" TEXT,
    "frozenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unfrozenAt" DATETIME,
    "unfrozenBy" TEXT,
    "unfreezeReason" TEXT,
    CONSTRAINT "budget_freezes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "budget_freezes_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "time_window_budgets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alert_suppressions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suppressedBy" TEXT,
    "suppressedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unsuppressedAt" DATETIME,
    CONSTRAINT "alert_suppressions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alert_suppressions_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "time_window_budgets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "process_traces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "sloConfigId" TEXT,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentCheckpoint" TEXT,
    "checkpointMessage" TEXT,
    "previousTraceId" TEXT,
    "operator" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "process_traces_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "process_traces_sloConfigId_fkey" FOREIGN KEY ("sloConfigId") REFERENCES "slo_configurations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "services_tenantId_name_key" ON "services"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "api_endpoints_serviceId_method_path_key" ON "api_endpoints"("serviceId", "method", "path");

-- CreateIndex
CREATE INDEX "error_samples_tenantId_timestamp_idx" ON "error_samples"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "error_samples_tenantId_isDeducted_idx" ON "error_samples"("tenantId", "isDeducted");

-- CreateIndex
CREATE INDEX "time_window_budgets_tenantId_windowStart_idx" ON "time_window_budgets"("tenantId", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "time_window_budgets_sloConfigId_windowStart_key" ON "time_window_budgets"("sloConfigId", "windowStart");

-- CreateIndex
CREATE INDEX "process_traces_tenantId_step_status_idx" ON "process_traces"("tenantId", "step", "status");
