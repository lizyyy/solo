const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'gift_refund.db');
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    threshold_amount REAL NOT NULL,
    gift_product_id TEXT NOT NULL,
    gift_quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS gift_inventory (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    total_quantity INTEGER NOT NULL,
    used_quantity INTEGER DEFAULT 0,
    available_quantity INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    total_amount REAL NOT NULL,
    activity_id TEXT,
    gift_qualified INTEGER DEFAULT 0,
    gift_product_id TEXT,
    gift_quantity INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (activity_id) REFERENCES activities(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    amount REAL NOT NULL,
    is_gift INTEGER DEFAULT 0,
    refund_quantity INTEGER DEFAULT 0,
    refund_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS split_orders (
    id TEXT PRIMARY KEY,
    parent_order_id TEXT NOT NULL,
    split_order_no TEXT NOT NULL UNIQUE,
    split_type TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_order_id) REFERENCES orders(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_item_id TEXT,
    refund_no TEXT NOT NULL UNIQUE,
    refund_type TEXT NOT NULL,
    refund_amount REAL NOT NULL,
    refund_quantity INTEGER DEFAULT 0,
    reason TEXT,
    operator TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    affect_gift INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS manual_gifts (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    gift_product_id TEXT NOT NULL,
    gift_product_name TEXT NOT NULL,
    gift_quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    operator TEXT NOT NULL,
    status TEXT DEFAULT 'approved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS qualification_recalculations (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    recalculate_type TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    result TEXT,
    operator TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS status_history (
    id TEXT PRIMARY KEY,
    business_type TEXT NOT NULL,
    business_id TEXT NOT NULL,
    before_status TEXT,
    after_status TEXT NOT NULL,
    before_value TEXT,
    after_value TEXT,
    operator TEXT NOT NULL,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS idempotent_records (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    business_type TEXT NOT NULL,
    business_id TEXT,
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});
module.exports = db;
