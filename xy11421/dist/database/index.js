"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbPath = getDbPath;
exports.initDatabase = initDatabase;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
function getDbPath() {
    return path_1.default.join(process.cwd(), 'car_inspect.db');
}
async function initDatabase() {
    const dbPath = getDbPath();
    if (fs_1.default.existsSync(dbPath)) {
        fs_1.default.unlinkSync(dbPath);
    }
    db = await (0, sqlite_1.open)({
        filename: dbPath,
        driver: sqlite3_1.default.Database
    });
    await createTables(db);
    return db;
}
async function getDatabase() {
    if (!db) {
        const dbPath = getDbPath();
        if (!fs_1.default.existsSync(dbPath)) {
            throw new Error('数据库不存在，请先执行 init 命令');
        }
        db = await (0, sqlite_1.open)({
            filename: dbPath,
            driver: sqlite3_1.default.Database
        });
    }
    return db;
}
async function createTables(db) {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      vin TEXT NOT NULL,
      carModel TEXT,
      plateNumber TEXT,
      inspector TEXT,
      inspectionDate TEXT,
      mileage INTEGER,
      items TEXT,
      estimatedCost REAL,
      sourceRow INTEGER,
      sourceFile TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      createdBy TEXT,
      batchId TEXT
    );

    CREATE TABLE IF NOT EXISTS repair_quotes (
      id TEXT PRIMARY KEY,
      vin TEXT NOT NULL,
      plateNumber TEXT,
      repairShop TEXT,
      quoteDate TEXT,
      itemName TEXT,
      quantity INTEGER,
      unitPrice REAL,
      totalPrice REAL,
      technician TEXT,
      sourceRow INTEGER,
      sourceFile TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      createdBy TEXT,
      batchId TEXT
    );

    CREATE TABLE IF NOT EXISTS photo_lists (
      id TEXT PRIMARY KEY,
      vin TEXT NOT NULL,
      plateNumber TEXT,
      photoDate TEXT,
      photoType TEXT,
      photoCount INTEGER,
      photographer TEXT,
      sourceRow INTEGER,
      sourceFile TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      createdBy TEXT,
      batchId TEXT
    );

    CREATE TABLE IF NOT EXISTS shift_records (
      id TEXT PRIMARY KEY,
      vin TEXT NOT NULL,
      plateNumber TEXT,
      shiftDate TEXT,
      shiftType TEXT,
      worker TEXT,
      workHours REAL,
      sourceRow INTEGER,
      sourceFile TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      createdBy TEXT,
      batchId TEXT
    );

    CREATE TABLE IF NOT EXISTS manual_prices (
      id TEXT PRIMARY KEY,
      vin TEXT NOT NULL,
      plateNumber TEXT,
      itemName TEXT,
      originalPrice REAL,
      adjustedPrice REAL,
      adjustReason TEXT,
      adjustDate TEXT,
      adjustedBy TEXT,
      sourceRow INTEGER,
      sourceFile TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      createdBy TEXT,
      batchId TEXT
    );

    CREATE TABLE IF NOT EXISTS dirty_records (
      id TEXT PRIMARY KEY,
      sourceType TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      dirtyType TEXT NOT NULL,
      fieldName TEXT,
      originalValue TEXT,
      expectedValue TEXT,
      description TEXT,
      suggestion TEXT,
      isFixed INTEGER DEFAULT 0,
      fixedBy TEXT,
      fixedAt TEXT,
      fixedValue TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      batchId TEXT
    );

    CREATE TABLE IF NOT EXISTS history_records (
      id TEXT PRIMARY KEY,
      sourceType TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      action TEXT NOT NULL,
      beforeData TEXT,
      afterData TEXT,
      diff TEXT,
      performedBy TEXT,
      performedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      sourceType TEXT NOT NULL,
      fileName TEXT,
      totalCount INTEGER,
      successCount INTEGER DEFAULT 0,
      failedCount INTEGER DEFAULT 0,
      dirtyCount INTEGER DEFAULT 0,
      importedBy TEXT,
      importedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      remark TEXT
    );
  `);
    await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_inspections_vin ON inspections(vin);
    CREATE INDEX IF NOT EXISTS idx_inspections_batch ON inspections(batchId);
    CREATE INDEX IF NOT EXISTS idx_repair_quotes_vin ON repair_quotes(vin);
    CREATE INDEX IF NOT EXISTS idx_repair_quotes_batch ON repair_quotes(batchId);
    CREATE INDEX IF NOT EXISTS idx_photo_lists_vin ON photo_lists(vin);
    CREATE INDEX IF NOT EXISTS idx_photo_lists_batch ON photo_lists(batchId);
    CREATE INDEX IF NOT EXISTS idx_shift_records_vin ON shift_records(vin);
    CREATE INDEX IF NOT EXISTS idx_shift_records_batch ON shift_records(batchId);
    CREATE INDEX IF NOT EXISTS idx_manual_prices_vin ON manual_prices(vin);
    CREATE INDEX IF NOT EXISTS idx_manual_prices_batch ON manual_prices(batchId);
    CREATE INDEX IF NOT EXISTS idx_dirty_records_source ON dirty_records(sourceType, sourceId);
    CREATE INDEX IF NOT EXISTS idx_dirty_records_batch ON dirty_records(batchId);
    CREATE INDEX IF NOT EXISTS idx_history_records_source ON history_records(sourceType, sourceId);
  `);
}
async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
    }
}
