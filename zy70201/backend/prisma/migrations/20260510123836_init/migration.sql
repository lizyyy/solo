-- CreateTable
CREATE TABLE "Slope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "length" REAL NOT NULL,
    "area" REAL NOT NULL,
    "openWindowStart" TEXT NOT NULL,
    "openWindowEnd" TEXT NOT NULL,
    "minSnowThickness" INTEGER NOT NULL,
    "targetSnowThickness" INTEGER NOT NULL,
    "currentSnowThickness" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "capacityPerHour" REAL NOT NULL,
    "currentLocation" TEXT NOT NULL,
    "lastMaintenance" DATETIME,
    "assignedTaskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slopeId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "scheduledStartTime" DATETIME NOT NULL,
    "scheduledEndTime" DATETIME NOT NULL,
    "actualStartTime" DATETIME,
    "actualEndTime" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    "reason" TEXT,
    "snowThicknessBefore" INTEGER,
    "snowThicknessAfter" INTEGER,
    "qualityScore" INTEGER,
    "notes" TEXT,
    "isReassigned" BOOLEAN NOT NULL DEFAULT false,
    "originalVehicleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_slopeId_fkey" FOREIGN KEY ("slopeId") REFERENCES "Slope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "reporter" TEXT NOT NULL,
    "reportTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snowThicknessBefore" INTEGER NOT NULL,
    "snowThicknessAfter" INTEGER NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "issues" TEXT NOT NULL,
    "remarks" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approver" TEXT,
    "approveTime" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Report_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_taskId_key" ON "Report"("taskId");
