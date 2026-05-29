import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../data/app.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initTables = [
  `CREATE TABLE IF NOT EXISTS script (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'sh',
    content TEXT NOT NULL,
    cloud_platform TEXT NOT NULL DEFAULT 'aws',
    existing_policy_json TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS api_call (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL REFERENCES script(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT DEFAULT '*',
    source TEXT NOT NULL DEFAULT 'static',
    line_number INTEGER,
    context TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS runtime_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL REFERENCES script(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    captured_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS permission (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL REFERENCES script(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    action TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'existing',
    status TEXT NOT NULL DEFAULT 'kept',
    reason TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS exception (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL REFERENCES script(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permission(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TEXT,
    impact_scope TEXT,
    risk_note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS risk_score (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL REFERENCES script(id) ON DELETE CASCADE,
    dynamic_miss_score INTEGER DEFAULT 0,
    wildcard_score INTEGER DEFAULT 0,
    exception_long_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    details_json TEXT DEFAULT '{}',
    calculated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS report_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES report(id) ON DELETE CASCADE,
    script_id INTEGER NOT NULL REFERENCES script(id),
    category TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    review_status TEXT NOT NULL DEFAULT 'pending',
    review_note TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
  )`,
];

for (const sql of initTables) {
  db.exec(sql);
}

const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_api_call_script ON api_call(script_id)',
  'CREATE INDEX IF NOT EXISTS idx_permission_script ON permission(script_id)',
  'CREATE INDEX IF NOT EXISTS idx_exception_script ON exception(script_id)',
  'CREATE INDEX IF NOT EXISTS idx_risk_score_script ON risk_score(script_id)',
  'CREATE INDEX IF NOT EXISTS idx_report_item_report ON report_item(report_id)',
  'CREATE INDEX IF NOT EXISTS idx_report_item_script ON report_item(script_id)',
];

for (const sql of indexes) {
  db.exec(sql);
}

export default db;
