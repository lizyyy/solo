"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
function initDatabase(dbPath) {
    const db = new better_sqlite3_1.default(dbPath);
    db.exec(`
    CREATE TABLE IF NOT EXISTS thresholds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      standardL REAL NOT NULL,
      standardA REAL NOT NULL,
      standardB REAL NOT NULL,
      deltaLMax REAL NOT NULL,
      deltaAMax REAL NOT NULL,
      deltaBMax REAL NOT NULL,
      deltaEMax REAL NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS paper_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batchNo TEXT NOT NULL UNIQUE,
      supplier TEXT NOT NULL,
      paperType TEXT NOT NULL,
      weight REAL NOT NULL,
      receivedDate TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('available', 'used', 'quarantined')),
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS print_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batchNo TEXT NOT NULL UNIQUE,
      productName TEXT NOT NULL,
      paperBatchId INTEGER NOT NULL,
      printDate TEXT NOT NULL,
      shift TEXT NOT NULL,
      operator TEXT NOT NULL,
      machineNo TEXT NOT NULL,
      thresholdId INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'reworked')) DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (paperBatchId) REFERENCES paper_batches(id),
      FOREIGN KEY (thresholdId) REFERENCES thresholds(id)
    );

    CREATE TABLE IF NOT EXISTS measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printBatchId INTEGER NOT NULL,
      measurementPoint TEXT NOT NULL,
      L REAL NOT NULL,
      a REAL NOT NULL,
      b REAL NOT NULL,
      deltaL REAL NOT NULL,
      deltaA REAL NOT NULL,
      deltaB REAL NOT NULL,
      deltaE REAL NOT NULL,
      isPass INTEGER NOT NULL DEFAULT 0,
      isRetained INTEGER NOT NULL DEFAULT 0,
      measuredAt TEXT NOT NULL,
      measuredBy TEXT NOT NULL,
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (printBatchId) REFERENCES print_batches(id),
      UNIQUE(printBatchId, measurementPoint, measuredAt)
    );

    CREATE TABLE IF NOT EXISTS rework_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printBatchId INTEGER NOT NULL,
      reworkType TEXT NOT NULL,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT,
      result TEXT NOT NULL CHECK(result IN ('pending', 'success', 'failed')) DEFAULT 'pending',
      notes TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (printBatchId) REFERENCES print_batches(id)
    );

    CREATE TABLE IF NOT EXISTS review_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      printBatchId INTEGER NOT NULL,
      reviewer TEXT NOT NULL,
      reviewDate TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('approve', 'reject', 'rework')),
      reason TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (printBatchId) REFERENCES print_batches(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reportNo TEXT NOT NULL UNIQUE,
      printBatchId INTEGER NOT NULL,
      generatedAt TEXT NOT NULL,
      generatedBy TEXT NOT NULL,
      totalMeasurements INTEGER NOT NULL,
      passCount INTEGER NOT NULL,
      failCount INTEGER NOT NULL,
      passRate REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft', 'final')) DEFAULT 'draft',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (printBatchId) REFERENCES print_batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_print_batches_batchNo ON print_batches(batchNo);
    CREATE INDEX IF NOT EXISTS idx_measurements_printBatchId ON measurements(printBatchId);
    CREATE INDEX IF NOT EXISTS idx_paper_batches_batchNo ON paper_batches(batchNo);
  `);
    return db;
}
//# sourceMappingURL=schema.js.map