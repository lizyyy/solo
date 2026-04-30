const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data', 'repair-shop.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到 SQLite 数据库');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS spare_parts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model TEXT,
    stock INTEGER DEFAULT 0,
    safe_stock INTEGER DEFAULT 5,
    unit TEXT DEFAULT '个',
    price REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    device_type TEXT,
    device_model TEXT,
    fault_description TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS spare_part_usages (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    spare_part_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'occupied',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (spare_part_id) REFERENCES spare_parts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS communications (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    operator TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
  )`);
});

module.exports = db;
