-- CreateTable
CREATE TABLE "ReceivingInstitution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "qualificationType" TEXT NOT NULL,
    "qualificationNum" TEXT NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recipient_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "ReceivingInstitution" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SampleBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNumber" TEXT NOT NULL,
    "sampleName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "productionDate" DATETIME NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "storageTempMin" REAL,
    "storageTempMax" REAL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentNumber" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "applicant" TEXT NOT NULL,
    "applicationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "purpose" TEXT NOT NULL,
    "remark" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "rejectReason" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shipment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SampleBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shipment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "ReceivingInstitution" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shipment_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemperatureRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "recordTime" DATETIME NOT NULL,
    "temperature" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NORMAL',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "reviewRemark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TemperatureRecord_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DestructionReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "destructionDate" DATETIME NOT NULL,
    "destructionMethod" TEXT NOT NULL,
    "witnessName" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "attachmentUrl" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DestructionReceipt_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT,
    "batchId" TEXT,
    "recipientId" TEXT,
    "tempRecordId" TEXT,
    "destructionId" TEXT,
    "action" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "actionTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "beforeSnapshot" TEXT,
    "afterSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditHistory_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SampleBatch_batchNumber_key" ON "SampleBatch"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNumber_key" ON "Shipment"("shipmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DestructionReceipt_shipmentId_key" ON "DestructionReceipt"("shipmentId");
