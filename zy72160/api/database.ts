import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'app.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS batch (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS import_job (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    import_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    record_count INTEGER NOT NULL DEFAULT 0,
    field_mapping TEXT,
    raw_preview TEXT,
    FOREIGN KEY (batch_id) REFERENCES batch(id)
  );

  CREATE TABLE IF NOT EXISTS raw_record (
    id TEXT PRIMARY KEY,
    import_job_id TEXT NOT NULL,
    row_index INTEGER NOT NULL,
    raw_data TEXT NOT NULL,
    mapped_data TEXT,
    FOREIGN KEY (import_job_id) REFERENCES import_job(id)
  );

  CREATE TABLE IF NOT EXISTS merged_point (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    gis_id TEXT,
    address TEXT NOT NULL,
    business_type TEXT,
    area REAL,
    source_count INTEGER NOT NULL DEFAULT 1,
    conflict_status TEXT NOT NULL DEFAULT 'none',
    original_notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES batch(id)
  );

  CREATE TABLE IF NOT EXISTS evidence_record (
    id TEXT PRIMARY KEY,
    merged_point_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    import_time TEXT NOT NULL,
    process_time TEXT NOT NULL,
    original_value TEXT DEFAULT '',
    FOREIGN KEY (merged_point_id) REFERENCES merged_point(id)
  );

  CREATE TABLE IF NOT EXISTS appended_note (
    id TEXT PRIMARY KEY,
    merged_point_id TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (merged_point_id) REFERENCES merged_point(id)
  );

  CREATE TABLE IF NOT EXISTS conflict_item (
    id TEXT PRIMARY KEY,
    merged_point_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    gis_value TEXT,
    imported_value TEXT,
    gis_source TEXT,
    import_source TEXT,
    suggestion TEXT NOT NULL DEFAULT 'manual',
    resolution TEXT,
    resolution_reason TEXT,
    resolved_at TEXT,
    resolved_by TEXT,
    FOREIGN KEY (merged_point_id) REFERENCES merged_point(id)
  );

  CREATE TABLE IF NOT EXISTS anomaly (
    id TEXT PRIMARY KEY,
    merged_point_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    human_readable TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    FOREIGN KEY (merged_point_id) REFERENCES merged_point(id),
    FOREIGN KEY (batch_id) REFERENCES batch(id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'system',
    timestamp TEXT NOT NULL,
    detail TEXT DEFAULT '',
    related_id TEXT,
    FOREIGN KEY (batch_id) REFERENCES batch(id)
  );

  CREATE INDEX IF NOT EXISTS idx_import_job_batch ON import_job(batch_id);
  CREATE INDEX IF NOT EXISTS idx_raw_record_job ON raw_record(import_job_id);
  CREATE INDEX IF NOT EXISTS idx_merged_point_batch ON merged_point(batch_id);
  CREATE INDEX IF NOT EXISTS idx_evidence_point ON evidence_record(merged_point_id);
  CREATE INDEX IF NOT EXISTS idx_appended_note_point ON appended_note(merged_point_id);
  CREATE INDEX IF NOT EXISTS idx_conflict_point ON conflict_item(merged_point_id);
  CREATE INDEX IF NOT EXISTS idx_anomaly_batch ON anomaly(batch_id);
  CREATE INDEX IF NOT EXISTS idx_anomaly_point ON anomaly(merged_point_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_batch ON audit_log(batch_id);
`)

export default db
