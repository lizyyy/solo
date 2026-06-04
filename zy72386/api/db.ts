import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DB_DIR = join(__dirname, '..', 'data')
const DB_PATH = join(DB_DIR, 'grain-vent.db')

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true })
}

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initTables(db)
  }
  return db
}

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      batch_label TEXT NOT NULL,
      file_name TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      duplicate_rows INTEGER NOT NULL DEFAULT 0,
      anomaly_count INTEGER NOT NULL DEFAULT 0,
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      import_id TEXT NOT NULL REFERENCES imports(id),
      original_row_number INTEGER NOT NULL,
      sensor_id TEXT NOT NULL,
      previous_sensor_id TEXT,
      nameplate_params TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'normal' CHECK(status IN ('normal','sensor_id_changed','anomaly','pending_review')),
      current_step INTEGER NOT NULL DEFAULT 1 CHECK(current_step BETWEEN 1 AND 3),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS manual_edits (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES records(id),
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      edited_by TEXT NOT NULL,
      edited_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sensor_id_changes (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES records(id),
      import_id TEXT NOT NULL REFERENCES imports(id),
      old_sensor_id TEXT NOT NULL,
      new_sensor_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review','confirmed','rejected')),
      stuck_at_step INTEGER NOT NULL DEFAULT 2 CHECK(stuck_at_step BETWEEN 1 AND 3),
      reviewed_by TEXT,
      reviewed_at TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS selfcheck_results (
      id TEXT PRIMARY KEY,
      import_id TEXT NOT NULL REFERENCES imports(id),
      check_type TEXT NOT NULL CHECK(check_type IN ('duplicate_import','sensor_id_changed','recalc_after_supplement','export_consistency')),
      status TEXT NOT NULL CHECK(status IN ('pass','warning','fail')),
      message TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '[]',
      checked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES records(id),
      import_id TEXT NOT NULL REFERENCES imports(id),
      action TEXT NOT NULL,
      field TEXT,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_import_id ON records(import_id);
    CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
    CREATE INDEX IF NOT EXISTS idx_sensor_changes_status ON sensor_id_changes(status);
    CREATE INDEX IF NOT EXISTS idx_sensor_changes_import_id ON sensor_id_changes(import_id);
    CREATE INDEX IF NOT EXISTS idx_audit_record_id ON audit_log(record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_import_id ON audit_log(import_id);
    CREATE INDEX IF NOT EXISTS idx_selfcheck_import_id ON selfcheck_results(import_id);
  `)
}
