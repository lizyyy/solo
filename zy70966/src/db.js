const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(config.dbPath);
ensureDir(config.uploadDir);
ensureDir(config.reportDir);

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initSql = `
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK(source_type IN ('qa_csv','summary_json','appeal_csv')),
  file_name TEXT NOT NULL,
  file_hash TEXT,
  record_count INTEGER DEFAULT 0,
  imported_by TEXT,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qa_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id INTEGER REFERENCES imports(id) ON DELETE SET NULL,
  call_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  team TEXT,
  call_date TEXT,
  score_total INTEGER DEFAULT 0,
  score_final INTEGER,
  status TEXT DEFAULT 'original' CHECK(status IN ('original','appealed','revised','final')),
  raw_payload TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(call_id)
);

CREATE TABLE IF NOT EXISTS deductions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qa_item_id INTEGER NOT NULL REFERENCES qa_items(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  rule_name TEXT,
  category TEXT,
  points_deducted INTEGER NOT NULL DEFAULT 0,
  reviewer TEXT,
  evidence TEXT,
  is_revoked INTEGER DEFAULT 0,
  revoked_reason TEXT,
  revoked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS call_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id INTEGER REFERENCES imports(id) ON DELETE SET NULL,
  call_id TEXT NOT NULL UNIQUE,
  summary TEXT,
  emotion TEXT,
  keywords TEXT,
  duration_sec INTEGER,
  raw_payload TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appeals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qa_item_id INTEGER NOT NULL REFERENCES qa_items(id) ON DELETE CASCADE,
  deduction_id INTEGER REFERENCES deductions(id) ON DELETE SET NULL,
  appellant TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','reviewing','upheld','overruled','secondary')),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appeal_id INTEGER NOT NULL REFERENCES appeals(id) ON DELETE CASCADE,
  qa_item_id INTEGER NOT NULL REFERENCES qa_items(id) ON DELETE CASCADE,
  deduction_id INTEGER REFERENCES deductions(id) ON DELETE SET NULL,
  reviewer TEXT,
  decision TEXT NOT NULL CHECK(decision IN ('upheld','overruled','partial')),
  comment TEXT,
  adjustment_points INTEGER DEFAULT 0,
  is_secondary INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS score_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qa_item_id INTEGER NOT NULL REFERENCES qa_items(id) ON DELETE CASCADE,
  score_before INTEGER,
  score_after INTEGER,
  delta INTEGER,
  reason TEXT,
  source_event TEXT,
  source_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qa_item_id INTEGER REFERENCES qa_items(id) ON DELETE SET NULL,
  appeal_id INTEGER REFERENCES appeals(id) ON DELETE SET NULL,
  review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
  actor TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  diff TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type TEXT NOT NULL,
  filters TEXT,
  summary_json TEXT,
  file_path TEXT,
  generated_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_qa_items_agent ON qa_items(agent_id);
CREATE INDEX IF NOT EXISTS idx_qa_items_call_date ON qa_items(call_date);
CREATE INDEX IF NOT EXISTS idx_deductions_qa_item ON deductions(qa_item_id);
CREATE INDEX IF NOT EXISTS idx_appeals_qa_item ON appeals(qa_item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_appeal ON reviews(appeal_id);
CREATE INDEX IF NOT EXISTS idx_audit_qa_item ON audit_log(qa_item_id);
`;

db.exec(initSql);

module.exports = db;
