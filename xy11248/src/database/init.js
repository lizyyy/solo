const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
const dbPath = path.join(dbDir, 'operation.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    group_leader_id TEXT NOT NULL,
    group_leader_name TEXT,
    user_id TEXT NOT NULL,
    user_name TEXT,
    total_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    has_exception BOOLEAN DEFAULT 0,
    exception_reason TEXT,
    imported_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    sku_id TEXT,
    sku_name TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    subtotal REAL NOT NULL,
    is_out_of_stock BOOLEAN DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    compensation_status TEXT DEFAULT 'none',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS compensations (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    order_item_id TEXT,
    type TEXT NOT NULL,
    amount REAL DEFAULT 0,
    coupon_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT NOT NULL,
    operator TEXT,
    confirmed_at TEXT,
    rolled_back_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (order_item_id) REFERENCES order_items(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    order_id TEXT,
    compensation_id TEXT,
    amount REAL NOT NULL,
    min_spend REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unused',
    valid_from TEXT NOT NULL,
    valid_to TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    batch_id TEXT,
    order_id TEXT,
    order_item_id TEXT,
    compensation_id TEXT,
    coupon_id TEXT,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    operator TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settlements (
    id TEXT PRIMARY KEY,
    settlement_no TEXT UNIQUE NOT NULL,
    group_leader_id TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    total_orders INTEGER DEFAULT 0,
    total_amount REAL DEFAULT 0,
    total_refund REAL DEFAULT 0,
    total_coupon REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    confirmed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settlement_items (
    id TEXT PRIMARY KEY,
    settlement_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    order_amount REAL NOT NULL,
    refund_amount REAL DEFAULT 0,
    coupon_amount REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS batch_operations (
    id TEXT PRIMARY KEY,
    batch_no TEXT UNIQUE NOT NULL,
    operation_type TEXT NOT NULL,
    total_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processing',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS batch_operation_items (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (batch_id) REFERENCES batch_operations(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_group_leader_id ON orders(group_leader_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_has_exception ON orders(has_exception)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_order_items_is_out_of_stock ON order_items(is_out_of_stock)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compensations_order_id ON compensations(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compensations_status ON compensations(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_coupons_valid_to ON coupons(valid_to)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_operation_logs_order_id ON operation_logs(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_operation_logs_batch_id ON operation_logs(batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_settlements_group_leader_id ON settlements(group_leader_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status)`);

  console.log('数据库表创建完成');
});

db.close();
