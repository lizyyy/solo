const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      check_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      total_count INTEGER DEFAULT 0,
      normal_count INTEGER DEFAULT 0,
      pending_count INTEGER DEFAULT 0,
      blocked_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS check_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      temperature REAL,
      has_medication INTEGER DEFAULT 0,
      medication_details TEXT,
      parent_confirmed INTEGER DEFAULT 0,
      parent_name TEXT,
      parent_phone TEXT,
      status TEXT DEFAULT 'pending',
      abnormal_type TEXT,
      handler TEXT,
      last_handler TEXT,
      follow_up_status TEXT DEFAULT 'pending',
      follow_up_remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS processing_trails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      old_abnormal_type TEXT,
      new_abnormal_type TEXT,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES check_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS change_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES check_records(id)
    )`);

    console.log('数据表初始化完成');
  });
}

module.exports = db;