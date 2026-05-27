const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'station.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      source TEXT,
      status TEXT DEFAULT 'active',
      created_by TEXT DEFAULT 'system',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      remark TEXT
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      pick_up_code TEXT UNIQUE NOT NULL,
      tracking_no TEXT,
      receiver_name TEXT NOT NULL,
      receiver_phone TEXT NOT NULL,
      receiver_address TEXT,
      arrived_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      sms_count INTEGER DEFAULT 0,
      last_sms_at TEXT,
      return_reason TEXT,
      return_batch_id INTEGER,
      returned_at TEXT,
      processed_at TEXT,
      processed_by TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (return_batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS sms_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      phone TEXT NOT NULL,
      content TEXT NOT NULL,
      send_status TEXT DEFAULT 'sent',
      sent_at TEXT DEFAULT (datetime('now', 'localtime')),
      created_by TEXT DEFAULT 'system',
      FOREIGN KEY (package_id) REFERENCES packages(id)
    );

    CREATE TABLE IF NOT EXISTS return_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_code TEXT UNIQUE NOT NULL,
      rule_name TEXT NOT NULL,
      overdue_days INTEGER DEFAULT 3,
      max_sms_count INTEGER DEFAULT 3,
      is_active INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER,
      batch_id INTEGER,
      action TEXT NOT NULL,
      reason TEXT,
      operator TEXT DEFAULT 'system',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      detail TEXT,
      FOREIGN KEY (package_id) REFERENCES packages(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_packages_pickup ON packages(pick_up_code);
    CREATE INDEX IF NOT EXISTS idx_packages_receiver ON packages(receiver_name);
    CREATE INDEX IF NOT EXISTS idx_packages_return_batch ON packages(return_batch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_package ON audit_logs(package_id);
    CREATE INDEX IF NOT EXISTS idx_sms_package ON sms_records(package_id);
  `);

  const ruleCount = db.prepare('SELECT COUNT(*) as cnt FROM return_rules').get().cnt;
  if (ruleCount === 0) {
    db.prepare(`
      INSERT INTO return_rules (rule_code, rule_name, overdue_days, max_sms_count, description)
      VALUES (?, ?, ?, ?, ?)
    `).run('DEFAULT', '默认退回规则', 3, 3, '超期3天或短信催取3次未取则触发退回');
  }
}

initTables();

module.exports = db;
