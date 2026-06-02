import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'cleanup.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v1',
    source TEXT NOT NULL CHECK(source IN ('excel', 'contract', 'manual')),
    audio_file_path TEXT,
    contract_id TEXT,
    auth_start_date TEXT,
    auth_end_date TEXT,
    contract_note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('passed', 'needs_review', 'old_caliber', 'pending')),
    anomaly_type TEXT CHECK(anomaly_type IN ('none', 'old_master', 'duplicate', 'missing_auth', 'manual_rename')),
    anomaly_detail TEXT,
    processing_suggestion TEXT,
    operator_note TEXT,
    processed_by TEXT,
    processed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    track_name TEXT NOT NULL,
    operator TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (track_id) REFERENCES tracks(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
  CREATE INDEX IF NOT EXISTS idx_tracks_anomaly_type ON tracks(anomaly_type);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_track_id ON audit_logs(track_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
`)

export function insertAuditLog(params: {
  track_id: number
  track_name: string
  operator: string
  action: string
  old_value?: string | null
  new_value?: string | null
  detail?: string | null
}) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (track_id, track_name, operator, action, old_value, new_value, detail)
    VALUES (@track_id, @track_name, @operator, @action, @old_value, @new_value, @detail)
  `)
  return stmt.run({
    old_value: null,
    new_value: null,
    detail: null,
    ...params,
  })
}

export default db
