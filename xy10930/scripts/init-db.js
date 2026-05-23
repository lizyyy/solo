const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'db');
const dbPath = path.join(dbDir, 'water_station.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('已创建 db 目录');
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到 SQLite 数据库');
});

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    address TEXT,
    total_deposit REAL DEFAULT 0,
    frozen_deposit REAL DEFAULT 0,
    available_deposit REAL DEFAULT 0,
    bucket_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS buckets (
    id TEXT PRIMARY KEY,
    bucket_no TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'in_stock',
    customer_id TEXT,
    current_delivery_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS delivery_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    delivery_address TEXT,
    bucket_count INTEGER NOT NULL,
    deposit_amount REAL NOT NULL,
    deposit_type TEXT DEFAULT 'new',
    status TEXT DEFAULT 'pending',
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposit_orders_buckets (
    id TEXT PRIMARY KEY,
    delivery_order_id TEXT NOT NULL,
    bucket_id TEXT NOT NULL,
    bucket_no TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id),
    FOREIGN KEY (bucket_id) REFERENCES buckets(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposit_transactions (
    id TEXT PRIMARY KEY,
    transaction_no TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    related_order_id TEXT,
    related_order_no TEXT,
    bucket_ids TEXT,
    bucket_nos TEXT,
    before_balance REAL,
    after_balance REAL,
    status TEXT DEFAULT 'completed',
    operator TEXT,
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (related_order_id) REFERENCES delivery_orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS return_records (
    id TEXT PRIMARY KEY,
    return_no TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    bucket_count INTEGER NOT NULL,
    refund_amount REAL NOT NULL,
    deduction_amount REAL DEFAULT 0,
    deduction_reason TEXT,
    bucket_ids TEXT,
    bucket_nos TEXT,
    related_delivery_ids TEXT,
    status TEXT DEFAULT 'completed',
    operator TEXT,
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    api_path TEXT NOT NULL,
    request_data TEXT NOT NULL,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    handling_result TEXT,
    handled_by TEXT,
    handled_at TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS status_history (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    operator TEXT,
    remark TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
    id TEXT PRIMARY KEY,
    correction_no TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    correction_type TEXT NOT NULL,
    before_value REAL,
    after_value REAL,
    reason TEXT NOT NULL,
    operator TEXT NOT NULL,
    related_exception_id TEXT,
    status TEXT DEFAULT 'approved',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`);

  console.log('数据库表创建完成');
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('数据库初始化完成');
});
