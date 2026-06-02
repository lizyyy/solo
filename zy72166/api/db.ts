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

const dbPath = path.join(dataDir, 'sunlight-review.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'importing',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS import_records (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    source TEXT NOT NULL CHECK(source IN ('sunlight', 'ledger')),
    raw_row TEXT NOT NULL,
    location_name TEXT NOT NULL,
    address TEXT NOT NULL,
    longitude REAL,
    latitude REAL,
    period TEXT NOT NULL,
    sunlight_hours REAL,
    complaint TEXT,
    remark TEXT,
    raw_remark TEXT NOT NULL,
    imported_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS precheck_warnings (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    type TEXT NOT NULL CHECK(type IN ('same_name', 'duplicate_complaint', 'coordinate_drift', 'cross_period', 'field_missing')),
    severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'error')),
    record_ids TEXT NOT NULL,
    description TEXT NOT NULL,
    original_values TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS merge_groups (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    type TEXT NOT NULL CHECK(type IN ('same_name', 'duplicate_complaint')),
    record_ids TEXT NOT NULL,
    strategy TEXT NOT NULL DEFAULT 'pending' CHECK(strategy IN ('merge', 'separate', 'pending')),
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS review_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    record_id TEXT NOT NULL REFERENCES import_records(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'passed', 'failed', 'needs_field_visit', 'conflict')),
    verdict TEXT,
    conflict_ledger_evidence TEXT,
    conflict_import_evidence TEXT,
    conflict_suggestion TEXT,
    conflict_resolved_by TEXT,
    conflict_resolved_at TEXT,
    conflict_resolution TEXT CHECK(conflict_resolution IS NULL OR conflict_resolution IN ('accept_ledger', 'accept_import', 'needs_field_visit'))
  );

  CREATE TABLE IF NOT EXISTS review_notes (
    id TEXT PRIMARY KEY,
    review_item_id TEXT NOT NULL REFERENCES review_items(id),
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    diff_from_previous TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS review_history (
    id TEXT PRIMARY KEY,
    review_item_id TEXT NOT NULL REFERENCES review_items(id),
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    old_verdict TEXT,
    new_verdict TEXT,
    reason TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS export_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    category TEXT NOT NULL CHECK(category IN ('processed', 'pending_verification', 'needs_field_visit')),
    record_id TEXT NOT NULL REFERENCES import_records(id),
    location_name TEXT NOT NULL,
    address TEXT NOT NULL,
    sunlight_hours REAL,
    verdict TEXT,
    judgment_basis TEXT NOT NULL,
    operator TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    handover_note TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_import_records_project ON import_records(project_id);
  CREATE INDEX IF NOT EXISTS idx_precheck_warnings_project ON precheck_warnings(project_id);
  CREATE INDEX IF NOT EXISTS idx_merge_groups_project ON merge_groups(project_id);
  CREATE INDEX IF NOT EXISTS idx_review_items_project ON review_items(project_id);
  CREATE INDEX IF NOT EXISTS idx_review_notes_review ON review_notes(review_item_id);
  CREATE INDEX IF NOT EXISTS idx_review_history_review ON review_history(review_item_id);
  CREATE INDEX IF NOT EXISTS idx_export_items_project ON export_items(project_id);
  CREATE INDEX IF NOT EXISTS idx_export_items_category ON export_items(category);
`)

export default db
