const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/database.db');
const dataDir = path.dirname(DB_PATH);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  console.log('开始初始化数据库...');

  db.run(`DROP TABLE IF EXISTS operation_logs`);
  db.run(`DROP TABLE IF EXISTS refunds`);
  db.run(`DROP TABLE IF EXISTS payments`);
  db.run(`DROP TABLE IF EXISTS order_operations`);
  db.run(`DROP TABLE IF EXISTS orders`);
  db.run(`DROP TABLE IF EXISTS group_buys`);
  db.run(`DROP TABLE IF EXISTS coupons`);
  db.run(`DROP TABLE IF EXISTS courses`);
  db.run(`DROP TABLE IF EXISTS users`);

  db.run(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    is_old_student INTEGER DEFAULT 0,
    old_student_discount_rate REAL DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  )`);

  db.run(`CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    original_price REAL NOT NULL,
    description TEXT,
    category TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
  )`);

  db.run(`CREATE TABLE coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    min_spend REAL DEFAULT 0,
    max_discount REAL,
    applicable_course_ids TEXT,
    is_stackable INTEGER DEFAULT 0,
    total_stock INTEGER DEFAULT -1,
    used_count INTEGER DEFAULT 0,
    start_time TEXT,
    end_time TEXT,
    created_at TEXT,
    updated_at TEXT
  )`);

  db.run(`CREATE TABLE group_buys (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    name TEXT NOT NULL,
    group_price REAL NOT NULL,
    min_people INTEGER DEFAULT 2,
    current_people INTEGER DEFAULT 0,
    lock_duration_minutes INTEGER DEFAULT 30,
    start_time TEXT,
    end_time TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`);

  db.run(`CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    original_price REAL NOT NULL,
    final_price REAL NOT NULL,
    discount_details TEXT,
    coupon_id TEXT,
    group_buy_id TEXT,
    is_old_student INTEGER DEFAULT 0,
    old_student_discount_applied REAL DEFAULT 0,
    status TEXT NOT NULL,
    status_history TEXT,
    price_lock_expires_at TEXT,
    is_price_locked INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (group_buy_id) REFERENCES group_buys(id)
  )`);

  db.run(`CREATE TABLE order_operations (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    operator_id TEXT,
    operator_name TEXT,
    before_data TEXT,
    after_data TEXT,
    change_reason TEXT,
    created_at TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  db.run(`CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    payment_no TEXT UNIQUE NOT NULL,
    order_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT,
    status TEXT NOT NULL,
    callback_id TEXT UNIQUE,
    callback_data TEXT,
    paid_at TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  db.run(`CREATE TABLE refunds (
    id TEXT PRIMARY KEY,
    refund_no TEXT UNIQUE NOT NULL,
    order_id TEXT NOT NULL,
    payment_id TEXT NOT NULL,
    refund_amount REAL NOT NULL,
    refund_type TEXT NOT NULL,
    refund_reason TEXT,
    return_coupon_id TEXT,
    status TEXT NOT NULL,
    operator_id TEXT,
    operator_name TEXT,
    refunded_at TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (payment_id) REFERENCES payments(id)
  )`);

  db.run(`CREATE TABLE operation_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    before_data TEXT,
    after_data TEXT,
    ip TEXT,
    created_at TEXT
  )`);

  db.run(`CREATE INDEX idx_orders_user ON orders(user_id)`);
  db.run(`CREATE INDEX idx_orders_status ON orders(status)`);
  db.run(`CREATE INDEX idx_payments_order ON payments(order_id)`);
  db.run(`CREATE INDEX idx_payments_callback ON payments(callback_id)`);
  db.run(`CREATE INDEX idx_refunds_order ON refunds(order_id)`);
  db.run(`CREATE INDEX idx_order_ops_order ON order_operations(order_id)`);

  console.log('数据库初始化完成！');
});

db.close();
