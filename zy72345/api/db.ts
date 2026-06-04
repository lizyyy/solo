import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '../data')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(path.resolve(dataDir, 'app.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS sampling_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fingerprint TEXT NOT NULL UNIQUE,
    record_count INTEGER NOT NULL DEFAULT 0,
    import_time TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS sampling_records (
    id TEXT PRIMARY KEY,
    list_id TEXT NOT NULL REFERENCES sampling_lists(id),
    original_value REAL NOT NULL,
    is_negative INTEGER NOT NULL DEFAULT 0,
    old_table_status TEXT NOT NULL DEFAULT 'normal',
    is_boundary INTEGER NOT NULL DEFAULT 0,
    boundary_status TEXT NOT NULL DEFAULT 'pending',
    remark TEXT NOT NULL DEFAULT ''
  );

  CREATE INDEX IF NOT EXISTS idx_records_list_id ON sampling_records(list_id);
  CREATE INDEX IF NOT EXISTS idx_records_boundary ON sampling_records(is_boundary, boundary_status);

  CREATE TABLE IF NOT EXISTS param_entries (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value REAL NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by TEXT NOT NULL DEFAULT 'system'
  );

  CREATE TABLE IF NOT EXISTS param_change_records (
    id TEXT PRIMARY KEY,
    param_id TEXT NOT NULL REFERENCES param_entries(id),
    field TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    change_type TEXT NOT NULL DEFAULT 'value'
  );

  CREATE INDEX IF NOT EXISTS idx_param_changes_param_id ON param_change_records(param_id);

  CREATE TABLE IF NOT EXISTS boundary_samples (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES sampling_records(id),
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    description TEXT NOT NULL DEFAULT '',
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed_by TEXT,
    confirmed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_boundary_status ON boundary_samples(status);

  CREATE TABLE IF NOT EXISTS review_comments (
    id TEXT PRIMARY KEY,
    boundary_id TEXT NOT NULL REFERENCES boundary_samples(id),
    author TEXT NOT NULL,
    author_role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_reviews_boundary_id ON review_comments(boundary_id);

  CREATE TABLE IF NOT EXISTS cost_allocation_results (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES sampling_records(id),
    allocated_cost REAL NOT NULL,
    is_boundary INTEGER NOT NULL DEFAULT 0,
    boundary_type TEXT,
    source_list_id TEXT NOT NULL REFERENCES sampling_lists(id),
    source_param_id TEXT REFERENCES param_entries(id)
  );

  CREATE INDEX IF NOT EXISTS idx_results_boundary ON cost_allocation_results(is_boundary);

  CREATE TABLE IF NOT EXISTS change_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    operator TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    can_rollback INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_change_log_timestamp ON change_log(timestamp);
`)

db.exec(`
  INSERT OR IGNORE INTO param_entries (id, key, value, description, updated_by) VALUES
    ('param-001', 'unit_cost', 100.0, '单位成本', 'system'),
    ('param-002', 'allocation_ratio', 1.0, '分摊比例', 'system'),
    ('param-003', 'min_sample_value', 0.0, '样本最小合理值（低于此值视为异常）', 'system'),
    ('param-004', 'max_sample_value', 999999.0, '样本最大合理值', 'system');
`)

export default db
