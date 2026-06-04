import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'fridge.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS calibration_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_line_number INTEGER NOT NULL,
    sensor_id TEXT NOT NULL,
    temperature REAL NOT NULL,
    direction TEXT NOT NULL,
    direction_normalized TEXT,
    direction_status TEXT NOT NULL DEFAULT 'normal' CHECK(direction_status IN ('normal', 'abnormal', 'pending_review')),
    status TEXT NOT NULL DEFAULT 'imported' CHECK(status IN ('imported', 'reviewed', 'confirmed', 'rolled_back')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('technician', 'lab_teacher')),
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (record_id) REFERENCES calibration_records(id)
  );
`)

export default db
