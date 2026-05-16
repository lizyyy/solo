const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'quota.db');

let db;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      }
    });
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  const fs = require('fs');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      cpu_quota INTEGER DEFAULT 0,
      storage_quota INTEGER DEFAULT 0,
      cpu_used INTEGER DEFAULT 0,
      storage_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS borrow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT UNIQUE NOT NULL,
      borrower_team TEXT NOT NULL,
      lender_team TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      borrow_date DATETIME NOT NULL,
      due_date DATETIME NOT NULL,
      return_date DATETIME,
      status TEXT NOT NULL,
      approver TEXT,
      approval_comment TEXT,
      approval_at DATETIME,
      settlement_summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER,
      action TEXT NOT NULL,
      operator TEXT,
      original_input TEXT,
      processing_rule TEXT,
      final_result TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES borrow_records(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_borrow_status ON borrow_records(status)`,
    `CREATE INDEX IF NOT EXISTS idx_borrow_due ON borrow_records(due_date)`,
    `CREATE INDEX IF NOT EXISTS idx_borrow_team ON borrow_records(borrower_team, lender_team)`
  ];

  for (const stmt of statements) {
    await run(stmt);
  }
  console.log('数据库表初始化完成');
}

module.exports = {
  getDatabase,
  run,
  get,
  all,
  initDatabase
};
