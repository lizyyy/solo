const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/reconciliation.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('初始化数据库...');

  db.run(`CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    manager TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    real_name TEXT NOT NULL,
    store_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    package_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    purchase_store_id TEXT,
    purchase_date DATE,
    total_amount DECIMAL(10,2) NOT NULL,
    original_amount DECIMAL(10,2),
    status TEXT DEFAULT 'active',
    valid_from DATE,
    valid_to DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reconciliation_batch_id TEXT,
    FOREIGN KEY (purchase_store_id) REFERENCES stores(id),
    FOREIGN KEY (reconciliation_batch_id) REFERENCES reconciliation_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS package_items (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    used_quantity INTEGER DEFAULT 0,
    remaining_quantity INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    store_id TEXT,
    service_advisor TEXT,
    order_date DATE,
    finish_date DATE,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'completed',
    payment_method TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reconciliation_batch_id TEXT,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (reconciliation_batch_id) REFERENCES reconciliation_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS work_order_items (
    id TEXT PRIMARY KEY,
    work_order_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_code TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    is_package_item INTEGER DEFAULT 0,
    related_package_id TEXT,
    replaced_from_item_code TEXT,
    replacement_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (related_package_id) REFERENCES packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    part_code TEXT NOT NULL,
    part_name TEXT NOT NULL,
    category TEXT,
    unit TEXT,
    unit_price DECIMAL(10,2),
    opening_quantity INTEGER DEFAULT 0,
    purchased_quantity INTEGER DEFAULT 0,
    used_quantity INTEGER DEFAULT 0,
    adjusted_quantity INTEGER DEFAULT 0,
    closing_quantity INTEGER DEFAULT 0,
    inventory_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reconciliation_batch_id TEXT,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (reconciliation_batch_id) REFERENCES reconciliation_batches(id),
    UNIQUE(store_id, part_code, inventory_date)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    part_code TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    related_order_no TEXT,
    related_package_id TEXT,
    operator TEXT,
    transaction_date DATE,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reconciliation_batches (
    id TEXT PRIMARY KEY,
    batch_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    store_id TEXT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT DEFAULT 'draft',
    total_packages INTEGER DEFAULT 0,
    total_work_orders INTEGER DEFAULT 0,
    total_inventory_items INTEGER DEFAULT 0,
    matched_count INTEGER DEFAULT 0,
    discrepancy_count INTEGER DEFAULT 0,
    reviewed_count INTEGER DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reconciliation_records (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    record_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    reference_no TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    review_status TEXT DEFAULT 'unreviewed',
    review_result TEXT,
    review_comment TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES reconciliation_batches(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reconciliation_discrepancies (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    record_id TEXT,
    discrepancy_type TEXT NOT NULL,
    discrepancy_code TEXT NOT NULL,
    severity TEXT NOT NULL,
    expected_value TEXT,
    actual_value TEXT,
    difference TEXT,
    explanation TEXT,
    source_details TEXT,
    is_resolved INTEGER DEFAULT 0,
    resolution_comment TEXT,
    resolved_by TEXT,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES reconciliation_batches(id),
    FOREIGN KEY (record_id) REFERENCES reconciliation_records(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    batch_id TEXT,
    record_id TEXT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    action_details TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES reconciliation_batches(id),
    FOREIGN KEY (record_id) REFERENCES reconciliation_records(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_packages_batch ON packages(reconciliation_batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_work_orders_batch ON work_orders(reconciliation_batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory(reconciliation_batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_discrepancies_record ON reconciliation_discrepancies(record_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_batch ON audit_logs(batch_id)`);

  console.log('数据库表创建完成');

  const bcrypt = require('bcryptjs');
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const storePassword = bcrypt.hashSync('store123', 10);

  db.run(`INSERT OR IGNORE INTO stores (id, name, code, address, manager, phone) VALUES 
    ('s001', '总部旗舰店', 'HQ001', '北京市朝阳区建国路88号', '张总店', '13800138001'),
    ('s002', '海淀分店', 'HD001', '北京市海淀区中关村大街1号', '李店长', '13800138002'),
    ('s003', '朝阳分店', 'CY001', '北京市朝阳区望京街10号', '王店长', '13800138003')`);

  db.run(`INSERT OR IGNORE INTO users (id, username, password_hash, real_name, store_id, role) VALUES 
    ('u001', 'admin', ?, '系统管理员', NULL, 'admin'),
    ('u002', 'manager_hq', ?, '张总店', 's001', 'store_manager'),
    ('u003', 'manager_hd', ?, '李店长', 's002', 'store_manager')`, [adminPassword, storePassword, storePassword], function(err) {
    if (err) {
      console.log('用户已存在，跳过初始化');
    } else {
      console.log('初始用户创建完成');
    }
  });

  console.log('数据库初始化完成');
  console.log('默认账号: admin / admin123, manager_hq / store123, manager_hd / store123');
});

db.close();
