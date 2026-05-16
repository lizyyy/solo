-- CreateTable
CREATE TABLE "Secret" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "last_access" DATETIME
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secret_id" TEXT NOT NULL,
    "secret_name" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "file_path" TEXT,
    "line_number" INTEGER,
    "last_access" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Reference_secret_id_fkey" FOREIGN KEY ("secret_id") REFERENCES "Secret" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReplacementPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secret_id" TEXT NOT NULL,
    "new_secret_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "planned_date" DATETIME NOT NULL,
    "approver" TEXT,
    "approval_comment" TEXT,
    "approval_date" DATETIME,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReplacementPlan_secret_id_fkey" FOREIGN KEY ("secret_id") REFERENCES "Secret" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secret_id" TEXT NOT NULL,
    "reference_id" TEXT,
    "accessed_by" TEXT,
    "access_source" TEXT,
    "accessed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessLog_secret_id_fkey" FOREIGN KEY ("secret_id") REFERENCES "Secret" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccessLog_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "Reference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CorrectionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secret_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT NOT NULL,
    "corrected_by" TEXT NOT NULL,
    "corrected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorrectionLog_secret_id_fkey" FOREIGN KEY ("secret_id") REFERENCES "Secret" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ErrorRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operation" TEXT NOT NULL,
    "raw_input" TEXT NOT NULL,
    "processing_basis" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "operator" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Secret_name_key" ON "Secret"("name");
