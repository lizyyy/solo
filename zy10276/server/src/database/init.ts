import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'violations.db');

export function initDatabase(): Database.Database {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      license_number TEXT NOT NULL UNIQUE,
      phone TEXT,
      total_points INTEGER DEFAULT 12 NOT NULL,
      remaining_points INTEGER DEFAULT 12 NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      plate_number TEXT NOT NULL UNIQUE,
      vehicle_type TEXT,
      brand TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      imported_by TEXT NOT NULL,
      total_records INTEGER DEFAULT 0,
      successful_records INTEGER DEFAULT 0,
      duplicate_records INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS violations (
      id TEXT PRIMARY KEY,
      violation_number TEXT UNIQUE,
      plate_number TEXT NOT NULL,
      vehicle_id TEXT,
      violation_time DATETIME NOT NULL,
      violation_type TEXT NOT NULL,
      location TEXT,
      description TEXT,
      points INTEGER DEFAULT 0,
      fine_amount DECIMAL(10,2) DEFAULT 0,
      status TEXT DEFAULT 'imported',
      matched_shift_id TEXT,
      matched_driver_id TEXT,
      import_batch_id TEXT,
      imported_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (matched_shift_id) REFERENCES shifts(id),
      FOREIGN KEY (matched_driver_id) REFERENCES drivers(id),
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id)
    );

    CREATE TABLE IF NOT EXISTS processing_history (
      id TEXT PRIMARY KEY,
      violation_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      remarks TEXT,
      old_status TEXT,
      new_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      violation_id TEXT NOT NULL UNIQUE,
      driver_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      materials_json TEXT,
      status TEXT DEFAULT 'pending',
      reviewer TEXT,
      review_notes TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE CASCADE,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS penalties (
      id TEXT PRIMARY KEY,
      violation_id TEXT NOT NULL UNIQUE,
      driver_id TEXT NOT NULL,
      points_deducted INTEGER DEFAULT 0,
      fine_amount DECIMAL(10,2) DEFAULT 0,
      is_rolled_back BOOLEAN DEFAULT FALSE,
      rolled_back_at DATETIME,
      rollback_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (violation_id) REFERENCES violations(id) ON DELETE CASCADE,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_violations_plate ON violations(plate_number);
    CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
    CREATE INDEX IF NOT EXISTS idx_violations_time ON violations(violation_time);
    CREATE INDEX IF NOT EXISTS idx_history_violation ON processing_history(violation_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_vehicle ON shifts(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_shifts_time ON shifts(start_time, end_time);
  `);

  return db;
}

export default initDatabase;
