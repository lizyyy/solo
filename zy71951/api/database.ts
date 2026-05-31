import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.resolve(__dirname, '..', 'data', 'inspection.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initTables(db)
  return db
}

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inspection_records (
      id TEXT PRIMARY KEY,
      tower_id TEXT NOT NULL,
      tower_name TEXT NOT NULL,
      flight_date TEXT NOT NULL,
      flight_time TEXT NOT NULL,
      pilot_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'normal' CHECK(status IN ('normal','warning','critical','corrected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_tower_id ON inspection_records(tower_id);
    CREATE INDEX IF NOT EXISTS idx_records_flight_date ON inspection_records(flight_date);
    CREATE INDEX IF NOT EXISTS idx_records_status ON inspection_records(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_records_unique ON inspection_records(tower_id, flight_date, flight_time, pilot_name);

    CREATE TABLE IF NOT EXISTS judgments (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES inspection_records(id) ON DELETE CASCADE,
      rule_name TEXT NOT NULL,
      rule_type TEXT NOT NULL CHECK(rule_type IN ('no_fly_zone','data_integrity','anomaly','custom')),
      triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
      matched_data TEXT NOT NULL DEFAULT '{}',
      conclusion TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      suggested_action TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info','warning','critical')),
      confirmed INTEGER NOT NULL DEFAULT 0,
      confirmed_by TEXT,
      confirmed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_judgments_record_id ON judgments(record_id);
    CREATE INDEX IF NOT EXISTS idx_judgments_rule_type ON judgments(rule_type);
    CREATE INDEX IF NOT EXISTS idx_judgments_severity ON judgments(severity);

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES inspection_records(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      file_type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'original' CHECK(source IN ('original','late_arrival')),
      arrived_at TEXT NOT NULL DEFAULT (datetime('now')),
      file_path TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attachments_record_id ON attachments(record_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_source ON attachments(source);

    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES inspection_records(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      old_value TEXT NOT NULL,
      new_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      corrected_by TEXT NOT NULL,
      corrected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_corrections_record_id ON corrections(record_id);

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES inspection_records(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK(event_type IN ('judgment','correction','attachment_add','status_change','import')),
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      actor TEXT NOT NULL,
      description TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_audit_record_id ON audit_events(record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      batch_name TEXT NOT NULL,
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      imported_by TEXT NOT NULL,
      total_items INTEGER NOT NULL DEFAULT 0,
      normal_count INTEGER NOT NULL DEFAULT 0,
      late_count INTEGER NOT NULL DEFAULT 0,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      correction_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed'))
    );

    CREATE TABLE IF NOT EXISTS import_items (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK(item_type IN ('normal','late_attachment','duplicate','manual_correction')),
      data TEXT NOT NULL DEFAULT '{}',
      action_taken TEXT,
      processed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_import_items_batch_id ON import_items(batch_id);
    CREATE INDEX IF NOT EXISTS idx_import_items_type ON import_items(item_type);
  `)
}
