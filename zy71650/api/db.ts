import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.resolve(__dirname, '..', 'data', 'envelope.db')

const dbDir = path.dirname(dbPath)
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initTables(db)
  }
  return db
}

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_files (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      duration REAL NOT NULL,
      sample_rate INTEGER NOT NULL,
      bpm REAL,
      bpm_confidence REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audio_samples (
      file_id TEXT NOT NULL REFERENCES audio_files(id),
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fitting_records (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL REFERENCES audio_files(id),
      instrument_label TEXT NOT NULL DEFAULT '',
      raw_attack REAL NOT NULL,
      raw_decay REAL NOT NULL,
      raw_sustain REAL NOT NULL,
      raw_release REAL NOT NULL,
      corrected_attack REAL,
      corrected_decay REAL,
      corrected_sustain REAL,
      corrected_release REAL,
      conclusion_attack REAL NOT NULL,
      conclusion_decay REAL NOT NULL,
      conclusion_sustain REAL NOT NULL,
      conclusion_release REAL NOT NULL,
      superseded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS anomaly_flags (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES fitting_records(id),
      type TEXT NOT NULL CHECK(type IN ('onset_misjudgment', 'noise_interference', 'parameter_out_of_bounds')),
      description TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high')),
      affected_param TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_entries (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES fitting_records(id),
      operation_type TEXT NOT NULL CHECK(operation_type IN ('fit', 'peak_detect', 'param_interpret', 'chart_export', 'history_compare')),
      judgment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS note_versions (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES fitting_records(id),
      content TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_current INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_fitting_records_file_id ON fitting_records(file_id);
    CREATE INDEX IF NOT EXISTS idx_anomaly_flags_record_id ON anomaly_flags(record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entries_record_id ON audit_entries(record_id);
    CREATE INDEX IF NOT EXISTS idx_note_versions_record_id ON note_versions(record_id);
    CREATE INDEX IF NOT EXISTS idx_fitting_records_superseded_by ON fitting_records(superseded_by);
  `)
}
