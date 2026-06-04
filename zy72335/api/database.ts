import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'app.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS import_logs (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL UNIQUE,
    operator TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    new_rows INTEGER NOT NULL DEFAULT 0,
    skipped_rows INTEGER NOT NULL DEFAULT 0,
    conflict_rows INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boundary_specs (
    id TEXT PRIMARY KEY,
    raw_row_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    min_value REAL,
    max_value REAL,
    unit TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (raw_row_id) REFERENCES raw_rows(id)
);

CREATE TABLE IF NOT EXISTS raw_rows (
    id TEXT PRIMARY KEY,
    unique_key TEXT NOT NULL,
    content TEXT NOT NULL,
    percentage_value TEXT,
    decimal_value TEXT,
    has_mixed_format INTEGER NOT NULL DEFAULT 0,
    boundary_id TEXT,
    import_batch_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (boundary_id) REFERENCES boundary_specs(id),
    FOREIGN KEY (import_batch_id) REFERENCES import_logs(batch_id),
    UNIQUE(unique_key)
);

CREATE TABLE IF NOT EXISTS change_records (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('raw_row', 'boundary', 'calculation')),
    entity_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT NOT NULL DEFAULT '',
    new_value TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    changed_by TEXT NOT NULL,
    affected_results TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calculation_details (
    id TEXT PRIMARY KEY,
    raw_row_id TEXT NOT NULL UNIQUE,
    kept INTEGER NOT NULL DEFAULT 1,
    keep_reason TEXT NOT NULL DEFAULT '',
    missing_materials TEXT NOT NULL DEFAULT '[]',
    next_action TEXT NOT NULL DEFAULT 'no_action' CHECK(next_action IN ('contact_activity_leader', 'contact_coach', 'no_action')),
    mixed_format_flagged INTEGER NOT NULL DEFAULT 0,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending', 'confirmed', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (raw_row_id) REFERENCES raw_rows(id)
);

CREATE TABLE IF NOT EXISTS workflow_status (
    id TEXT PRIMARY KEY DEFAULT '1',
    raw_row_imported INTEGER NOT NULL DEFAULT 0,
    raw_row_imported_at TEXT,
    boundary_reviewed INTEGER NOT NULL DEFAULT 0,
    boundary_reviewed_at TEXT,
    calculation_updated INTEGER NOT NULL DEFAULT 0,
    calculation_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_raw_rows_batch ON raw_rows(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_raw_rows_mixed ON raw_rows(has_mixed_format);
CREATE INDEX IF NOT EXISTS idx_boundary_specs_raw_row ON boundary_specs(raw_row_id);
CREATE INDEX IF NOT EXISTS idx_change_records_entity ON change_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_calculation_details_status ON calculation_details(review_status);
CREATE INDEX IF NOT EXISTS idx_calculation_details_flagged ON calculation_details(mixed_format_flagged);
`)

db.exec(`INSERT OR IGNORE INTO workflow_status (id) VALUES ('1')`)

export default db
