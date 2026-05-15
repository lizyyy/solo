const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'app.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS heartbeat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      status TEXT NOT NULL,
      last_normal_time TEXT,
      last_report_time TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transfer_records (
      id TEXT PRIMARY KEY,
      batch_no TEXT NOT NULL,
      source_system TEXT NOT NULL,
      finance_type TEXT NOT NULL,
      amount REAL NOT NULL,
      transfer_date TEXT NOT NULL,
      handler TEXT,
      handler_department TEXT,
      status TEXT NOT NULL,
      error_type TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS process_history (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_department TEXT,
      before_status TEXT,
      after_status TEXT,
      remark TEXT,
      receipt_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES transfer_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS material_summaries (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      summary_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES transfer_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS batch_previews (
      id TEXT PRIMARY KEY,
      batch_no TEXT NOT NULL,
      action_type TEXT NOT NULL,
      affected_count INTEGER NOT NULL,
      affected_ids TEXT NOT NULL,
      preview_data TEXT,
      status TEXT DEFAULT 'pending',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rollback_candidates (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      candidate_data TEXT,
      status TEXT DEFAULT 'pending',
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES transfer_records(id)
    )
  `);

  console.log('数据库表初始化完成');
});

module.exports = db;
