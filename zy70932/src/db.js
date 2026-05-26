const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'supervision.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      node_csv_path TEXT,
      photo_json_path TEXT,
      rectification_form_path TEXT,
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      site_node TEXT NOT NULL,
      supervisor_signature TEXT,
      rectification_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      raw_data TEXT,
      photo_list TEXT,
      rectification_form TEXT,
      current_remark TEXT,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_records_site_node ON records(site_node);
    CREATE INDEX IF NOT EXISTS idx_records_signature ON records(supervisor_signature);
    CREATE INDEX IF NOT EXISTS idx_records_rect_count ON records(rectification_count);
    CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
    CREATE INDEX IF NOT EXISTS idx_records_batch ON records(batch_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      handler TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      details TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

    CREATE TABLE IF NOT EXISTS exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      reason TEXT,
      handler TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved INTEGER DEFAULT 0,
      resolved_at DATETIME,
      resolved_by TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_exceptions_record ON exceptions(record_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_type ON exceptions(type);

    CREATE TABLE IF NOT EXISTS rectifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      rectification_no TEXT,
      rectification_count INTEGER DEFAULT 1,
      rectification_form_data TEXT,
      source_rectification_id INTEGER,
      source_record_id INTEGER,
      handler TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES records(id),
      FOREIGN KEY (source_rectification_id) REFERENCES rectifications(id),
      FOREIGN KEY (source_record_id) REFERENCES records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_rectifications_record ON rectifications(record_id);
    CREATE INDEX IF NOT EXISTS idx_rectifications_source_rect ON rectifications(source_rectification_id);
    CREATE INDEX IF NOT EXISTS idx_rectifications_source_rec ON rectifications(source_record_id);
  `);

  // Migration: add source_rectification_id if not exists
  try {
    const cols = db.prepare("PRAGMA table_info(rectifications)").all();
    const hasSourceRectId = cols.some(c => c.name === 'source_rectification_id');
    if (!hasSourceRectId) {
      db.prepare("ALTER TABLE rectifications ADD COLUMN source_rectification_id INTEGER").run();
    }
  } catch (e) {
    // ignore
  }
}

function getDb() {
  return db;
}

module.exports = { init, getDb };