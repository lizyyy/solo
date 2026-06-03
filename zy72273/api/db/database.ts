import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_DIR = path.resolve(__dirname, '../../data')
const DB_PATH = path.resolve(DB_DIR, 'calibration.db')

let db: Database.Database | null = null

function initDatabase(): Database.Database {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }
  const database = new Database(DB_PATH)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')

  database.exec(`
    CREATE TABLE IF NOT EXISTS calibration_records (
      id TEXT PRIMARY KEY,
      beacon_id TEXT NOT NULL,
      origin_description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('calibrated','pending_review','pending_photo','anomaly')),
      coordinate_mix_detected INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coordinate_entries (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES calibration_records(id),
      point_name TEXT NOT NULL,
      coordinate_type TEXT NOT NULL CHECK(coordinate_type IN ('latlng','metric','mixed')),
      lat REAL,
      lng REAL,
      x REAL,
      y REAL,
      z REAL,
      manual_correction TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES calibration_records(id),
      action TEXT NOT NULL CHECK(action IN ('import','supplement_photo','manual_correct','rerun','update_note')),
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL CHECK(operator_role IN ('operations','inspection','system')),
      description TEXT NOT NULL,
      reason TEXT,
      before_snapshot TEXT,
      after_snapshot TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS field_team_notes (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL UNIQUE REFERENCES calibration_records(id),
      why_left_behind TEXT NOT NULL DEFAULT '',
      missing_materials TEXT NOT NULL DEFAULT '[]',
      next_step TEXT NOT NULL DEFAULT '{}',
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS inspection_photos (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES calibration_records(id),
      photo_id TEXT NOT NULL,
      supplemented_by TEXT,
      supplemented_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_records_status ON calibration_records(status);
    CREATE INDEX IF NOT EXISTS idx_entries_record ON coordinate_entries(record_id);
    CREATE INDEX IF NOT EXISTS idx_logs_record ON operation_logs(record_id);
    CREATE INDEX IF NOT EXISTS idx_photos_record ON inspection_photos(record_id);
  `)

  return database
}

export function getDb(): Database.Database {
  if (!db) {
    db = initDatabase()
  }
  return db
}
