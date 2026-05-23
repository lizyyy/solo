const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'clinic.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      gender TEXT,
      birthday TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS treatment_packages (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      name TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      remaining_count INTEGER NOT NULL,
      gift_count INTEGER NOT NULL DEFAULT 0,
      used_gift_count INTEGER NOT NULL DEFAULT 0,
      purchase_date TEXT NOT NULL,
      expire_date TEXT NOT NULL,
      original_store_id TEXT NOT NULL,
      current_store_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (original_store_id) REFERENCES stores(id),
      FOREIGN KEY (current_store_id) REFERENCES stores(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS package_split_records (
      id TEXT PRIMARY KEY,
      parent_package_id TEXT NOT NULL,
      child_package_id TEXT NOT NULL,
      split_count INTEGER NOT NULL,
      split_gift_count INTEGER NOT NULL DEFAULT 0,
      operator TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (parent_package_id) REFERENCES treatment_packages(id),
      FOREIGN KEY (child_package_id) REFERENCES treatment_packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS gift_records (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      gift_count INTEGER NOT NULL,
      reason TEXT,
      operator TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (package_id) REFERENCES treatment_packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS store_transfer_requests (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      from_store_id TEXT NOT NULL,
      to_store_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      request_note TEXT,
      approval_note TEXT,
      operator TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (package_id) REFERENCES treatment_packages(id),
      FOREIGN KEY (from_store_id) REFERENCES stores(id),
      FOREIGN KEY (to_store_id) REFERENCES stores(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS extension_requests (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      original_expire_date TEXT NOT NULL,
      new_expire_date TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approval_note TEXT,
      operator TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (package_id) REFERENCES treatment_packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS verification_records (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      verify_count INTEGER NOT NULL,
      use_gift_count INTEGER NOT NULL DEFAULT 0,
      use_paid_count INTEGER NOT NULL DEFAULT 0,
      verify_date TEXT NOT NULL,
      operator TEXT,
      remark TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (package_id) REFERENCES treatment_packages(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exception_logs (
      id TEXT PRIMARY KEY,
      request_type TEXT NOT NULL,
      request_data TEXT NOT NULL,
      error_message TEXT NOT NULL,
      process_result TEXT NOT NULL,
      operator TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS manual_corrections (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      before_data TEXT NOT NULL,
      after_data TEXT NOT NULL,
      reason TEXT,
      operator TEXT,
      created_at TEXT NOT NULL
    )
  `);

  console.log('数据库表创建完成');
});

db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('数据库连接已关闭');
});
