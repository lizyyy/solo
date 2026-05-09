-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "merchantNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "feeRuleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Merchant_feeRuleId_fkey" FOREIGN KEY ("feeRuleId") REFERENCES "FeeRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "feeType" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "minFee" REAL NOT NULL,
    "maxFee" REAL,
    "tierConfig" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SettlementBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNo" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "settlementDate" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "refundAmount" REAL NOT NULL DEFAULT 0,
    "chargebackAmount" REAL NOT NULL DEFAULT 0,
    "feeAmount" REAL NOT NULL,
    "netAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "suspendReason" TEXT,
    "suspendNote" TEXT,
    "suspendedAt" DATETIME,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SettlementBatch_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionNo" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "transactionDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "feeAmount" REAL NOT NULL,
    "refundAmount" REAL NOT NULL DEFAULT 0,
    "chargebackAmount" REAL NOT NULL DEFAULT 0,
    "hasPendingRefund" BOOLEAN NOT NULL DEFAULT false,
    "hasPendingChargeback" BOOLEAN NOT NULL DEFAULT false,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SettlementBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExceptionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exceptionNo" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "exceptionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExceptionRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SettlementBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "approvalType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requester" TEXT NOT NULL,
    "approver" TEXT,
    "requestNote" TEXT,
    "approvalNote" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    CONSTRAINT "ApprovalRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SettlementBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SettlementReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportNo" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "reportDate" DATETIME NOT NULL,
    "reportType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementReport_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SettlementBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operationNo" TEXT NOT NULL,
    "batchId" TEXT,
    "operator" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_merchantNo_key" ON "Merchant"("merchantNo");

-- CreateIndex
CREATE INDEX "Merchant_merchantNo_idx" ON "Merchant"("merchantNo");

-- CreateIndex
CREATE INDEX "FeeRule_isActive_effectiveFrom_idx" ON "FeeRule"("isActive", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementBatch_batchNo_key" ON "SettlementBatch"("batchNo");

-- CreateIndex
CREATE INDEX "SettlementBatch_merchantId_settlementDate_idx" ON "SettlementBatch"("merchantId", "settlementDate");

-- CreateIndex
CREATE INDEX "SettlementBatch_status_idx" ON "SettlementBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BatchTransaction_transactionNo_key" ON "BatchTransaction"("transactionNo");

-- CreateIndex
CREATE INDEX "BatchTransaction_batchId_idx" ON "BatchTransaction"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ExceptionRecord_exceptionNo_key" ON "ExceptionRecord"("exceptionNo");

-- CreateIndex
CREATE INDEX "ExceptionRecord_batchId_isResolved_idx" ON "ExceptionRecord"("batchId", "isResolved");

-- CreateIndex
CREATE INDEX "ExceptionRecord_exceptionType_idx" ON "ExceptionRecord"("exceptionType");

-- CreateIndex
CREATE INDEX "ApprovalRecord_batchId_status_idx" ON "ApprovalRecord"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementReport_reportNo_key" ON "SettlementReport"("reportNo");

-- CreateIndex
CREATE INDEX "SettlementReport_batchId_reportDate_idx" ON "SettlementReport"("batchId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "OperationLog_operationNo_key" ON "OperationLog"("operationNo");

-- CreateIndex
CREATE INDEX "OperationLog_batchId_createdAt_idx" ON "OperationLog"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationLog_operator_createdAt_idx" ON "OperationLog"("operator", "createdAt");
