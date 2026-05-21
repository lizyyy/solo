const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/medicine-inventory.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到SQLite数据库');
});

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`CREATE TABLE IF NOT EXISTS medicines (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    specification TEXT,
    manufacturer TEXT,
    unit TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    system_code TEXT UNIQUE NOT NULL,
    sync_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory_batches (
    id TEXT PRIMARY KEY,
    medicine_id TEXT NOT NULL,
    batch_no TEXT NOT NULL,
    production_date DATE,
    expiry_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    occupied_quantity INTEGER NOT NULL DEFAULT 0,
    source_id TEXT NOT NULL,
    warehouse_location TEXT,
    status TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id),
    FOREIGN KEY (source_id) REFERENCES inventory_sources(id),
    UNIQUE(medicine_id, batch_no, source_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS occupancy_records (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    order_no TEXT,
    department TEXT,
    operator TEXT,
    reason TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    released_at DATETIME,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expiry_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    warning_days INTEGER NOT NULL,
    critical_days INTEGER NOT NULL,
    is_default BOOLEAN DEFAULT 0,
    medicine_categories TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS delivery_receipts (
    id TEXT PRIMARY KEY,
    delivery_no TEXT UNIQUE NOT NULL,
    source_id TEXT NOT NULL,
    total_quantity INTEGER NOT NULL,
    received_quantity INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    delivery_time DATETIME,
    receive_time DATETIME,
    operator TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES inventory_sources(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS delivery_items (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL,
    medicine_id TEXT NOT NULL,
    batch_no TEXT NOT NULL,
    planned_quantity INTEGER NOT NULL,
    actual_quantity INTEGER,
    expiry_date DATE,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receipt_id) REFERENCES delivery_receipts(id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS discrepancy_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    source_id TEXT,
    medicine_id TEXT,
    batch_no TEXT,
    expected_quantity INTEGER NOT NULL,
    actual_quantity INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolver TEXT,
    resolution TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES inventory_sources(id),
    FOREIGN KEY (medicine_id) REFERENCES medicines(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sync_logs (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    record_count INTEGER DEFAULT 0,
    error_message TEXT,
    request_id TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (source_id) REFERENCES inventory_sources(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    before_data TEXT,
    after_data TEXT,
    operator TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('数据库表创建完成');
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('数据库连接已关闭');
});
