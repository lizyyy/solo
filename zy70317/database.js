const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'accounting.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到 SQLite 数据库');
});

const initializeTables = () => {
  const statements = [
    `CREATE TABLE IF NOT EXISTS business_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL,
      paid_at TEXT,
      cancelled_at TEXT
    )`,
    
    `CREATE TABLE IF NOT EXISTS accounting_flows (
      id TEXT PRIMARY KEY,
      flow_no TEXT UNIQUE NOT NULL,
      order_no TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS reconciliation_scans (
      id TEXT PRIMARY KEY,
      scan_date TEXT NOT NULL,
      total_orders INTEGER NOT NULL,
      matched_orders INTEGER NOT NULL,
      diff_orders INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS reconciliation_diffs (
      id TEXT PRIMARY KEY,
      diff_type TEXT NOT NULL,
      order_no TEXT NOT NULL,
      order_amount REAL,
      flow_amount REAL,
      diff_amount REAL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      diff_reason TEXT NOT NULL,
      scan_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      closed_at TEXT,
      close_reason TEXT,
      FOREIGN KEY (scan_id) REFERENCES reconciliation_scans(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS compensation_tasks (
      id TEXT PRIMARY KEY,
      diff_id TEXT NOT NULL,
      order_no TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      executed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (diff_id) REFERENCES reconciliation_diffs(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS compensation_records (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      diff_id TEXT NOT NULL,
      order_no TEXT NOT NULL,
      flow_no TEXT,
      amount REAL NOT NULL,
      operation_type TEXT NOT NULL,
      status TEXT NOT NULL,
      operated_at TEXT NOT NULL,
      remark TEXT,
      FOREIGN KEY (task_id) REFERENCES compensation_tasks(id),
      FOREIGN KEY (diff_id) REFERENCES reconciliation_diffs(id)
    )`
  ];
  
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      statements.forEach((stmt) => {
        db.run(stmt, (err) => {
          if (err) {
            console.error('表创建失败:', err.message);
            reject(err);
          }
        });
      });
      resolve();
    });
  });
};

module.exports = {
  db,
  initializeTables,
  DB_PATH
};
