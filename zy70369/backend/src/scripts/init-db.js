const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/arbitration.db');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_exceptions (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      exception_type TEXT NOT NULL,
      status TEXT NOT NULL,
      locked_by TEXT,
      locked_at TEXT,
      resolution TEXT,
      resolution_reason TEXT,
      resolved_at TEXT,
      evidence_gap TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_evidence (
      id TEXT PRIMARY KEY,
      order_exception_id TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      evidence_data TEXT NOT NULL,
      is_valid INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_exception_id) REFERENCES order_exceptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS arbitration_actions (
      id TEXT PRIMARY KEY,
      order_exception_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_data TEXT,
      status TEXT NOT NULL,
      executed_by TEXT NOT NULL,
      executed_at TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_exception_id) REFERENCES order_exceptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_timeline (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT,
      operator TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operators (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  console.log('数据库初始化完成');
});

db.close();
