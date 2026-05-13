const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'mall_coupon.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    level TEXT NOT NULL,
    level_before TEXT,
    points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS coupon_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    member_id INTEGER NOT NULL,
    total_count INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    remaining_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    valid_start_date DATE,
    valid_end_date DATE,
    total_count_before INTEGER,
    used_count_before INTEGER,
    remaining_count_before INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_no TEXT UNIQUE NOT NULL,
    package_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    discount_value DECIMAL(10,2),
    min_spend DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'available',
    valid_start_date DATE,
    valid_end_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES coupon_packages(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    manager TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    verification_no TEXT UNIQUE NOT NULL,
    coupon_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    store_id INTEGER NOT NULL,
    operator TEXT NOT NULL,
    verification_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    order_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    status TEXT DEFAULT 'normal',
    is_blocked INTEGER DEFAULT 0,
    block_reason TEXT,
    store_id_before INTEGER,
    status_before TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    refund_no TEXT UNIQUE NOT NULL,
    verification_id INTEGER NOT NULL,
    coupon_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    store_id INTEGER NOT NULL,
    refund_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    operator TEXT NOT NULL,
    refund_amount DECIMAL(10,2),
    is_coupon_returned INTEGER DEFAULT 0,
    return_status TEXT DEFAULT 'pending',
    exception_type TEXT,
    exception_note TEXT,
    handler TEXT,
    handle_time DATETIME,
    handle_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (verification_id) REFERENCES verifications(id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    operator TEXT NOT NULL,
    operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    old_value TEXT,
    new_value TEXT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS import_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_no TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    operator TEXT NOT NULL,
    import_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('数据库表创建完成');
});

db.close();
