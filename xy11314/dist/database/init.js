"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
exports.generateBatchId = generateBatchId;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const DB_PATH = path_1.default.join(process.cwd(), 'bus-scheduler.db');
let dbInstance = null;
async function getDatabase() {
    if (dbInstance) {
        return dbInstance;
    }
    const db = await (0, sqlite_1.open)({
        filename: DB_PATH,
        driver: sqlite3_1.default.Database
    });
    await initializeTables(db);
    dbInstance = db;
    return db;
}
async function initializeTables(db) {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS stop_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      stop_name TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      import_batch_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(route_id, stop_id, scheduled_time, import_batch_id)
    );

    CREATE TABLE IF NOT EXISTS gps_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL NOT NULL,
      accuracy REAL NOT NULL,
      import_batch_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(device_id, timestamp, import_batch_id)
    );

    CREATE TABLE IF NOT EXISTS driver_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id TEXT NOT NULL,
      route_id TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      checkin_time TEXT NOT NULL,
      checkin_type TEXT NOT NULL CHECK(checkin_type IN ('arrival', 'departure')),
      import_batch_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(driver_id, stop_id, checkin_time, import_batch_id)
    );

    CREATE TABLE IF NOT EXISTS parent_complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id TEXT NOT NULL UNIQUE,
      parent_name TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      student_name TEXT NOT NULL,
      route_id TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      actual_arrival_time TEXT,
      complaint_type TEXT NOT NULL CHECK(complaint_type IN ('late', 'no_show', 'early', 'other')),
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      import_batch_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bad_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_batch_id TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('schedule_csv', 'gps_json', 'complaint', 'checkin')),
      raw_data TEXT NOT NULL,
      row_number INTEGER,
      failure_reason TEXT NOT NULL,
      suggested_fix TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS match_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      gps_records_json TEXT NOT NULL,
      checkin_records_json TEXT NOT NULL,
      stop_schedule_id INTEGER NOT NULL,
      match_confidence REAL NOT NULL,
      time_discrepancy_minutes REAL NOT NULL,
      distance_discrepancy_meters REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'matched',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (complaint_id) REFERENCES parent_complaints(id),
      FOREIGN KEY (stop_schedule_id) REFERENCES stop_schedules(id),
      UNIQUE(complaint_id)
    );

    CREATE TABLE IF NOT EXISTS adjudications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      complaint_id INTEGER NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('driver_fault', 'traffic_fault', 'parent_fault', 'system_error', 'undetermined')),
      confidence REAL NOT NULL,
      reasons_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      adjudicator TEXT NOT NULL,
      adjudicated_at DATETIME NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK(review_status IN ('confirmed', 'overturned', 'pending_review')),
      reviewed_by TEXT,
      reviewed_at DATETIME,
      review_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES match_records(id),
      FOREIGN KEY (complaint_id) REFERENCES parent_complaints(id),
      UNIQUE(match_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      details TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_complaints_route ON parent_complaints(route_id);
    CREATE INDEX IF NOT EXISTS idx_gps_driver ON gps_records(driver_id);
    CREATE INDEX IF NOT EXISTS idx_gps_timestamp ON gps_records(timestamp);
    CREATE INDEX IF NOT EXISTS idx_match_complaint ON match_records(complaint_id);
  `);
}
async function closeDatabase() {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
    }
}
function generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
