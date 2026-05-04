const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'printshop.db');

let db;

function initDB() {
  const isNew = !fs.existsSync(DB_PATH);
  db = new Database(DB_PATH);
  
  db.exec(`PRAGMA foreign_keys = ON;`);
  
  // 客户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      wechat TEXT,
      address TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 纸张耗材表
  db.exec(`
    CREATE TABLE IF NOT EXISTS paper_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      size TEXT,
      weight INTEGER,
      color TEXT,
      unit_price REAL,
      stock_qty REAL,
      min_stock REAL,
      supplier TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 规格模板表
  db.exec(`
    CREATE TABLE IF NOT EXISTS spec_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      product_type TEXT,
      width REAL,
      height REAL,
      unit TEXT DEFAULT 'mm',
      bleed REAL,
      resolution INTEGER DEFAULT 300,
      color_mode TEXT DEFAULT 'CMYK',
      default_quantity INTEGER,
      sheet_size TEXT,
      sheets_per_sheet INTEGER,
      waste_rate REAL DEFAULT 0.05,
      process_ids TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 工序表
  db.exec(`
    CREATE TABLE IF NOT EXISTS processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      cost_per_unit REAL,
      setup_time INTEGER,
      time_per_unit REAL,
      capacity_per_hour REAL,
      requires_machine INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 机器设备表
  db.exec(`
    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      status TEXT DEFAULT 'available',
      capacity_per_hour REAL,
      working_hours_start TEXT,
      working_hours_end TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 订单表
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE,
      customer_id INTEGER,
      spec_template_id INTEGER,
      product_type TEXT,
      width REAL,
      height REAL,
      quantity INTEGER,
      paper_id INTEGER,
      paper_qty_est REAL,
      paper_qty_actual REAL,
      process_ids TEXT,
      pickup_time DATETIME,
      status TEXT DEFAULT 'pending',
      total_cost REAL,
      total_price REAL,
      paid_amount REAL,
      paid_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (spec_template_id) REFERENCES spec_templates(id),
      FOREIGN KEY (paper_id) REFERENCES paper_stock(id)
    );
  `);

  // 订单状态历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      reason TEXT,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);

  // 上传文件记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS upload_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      original_name TEXT,
      file_path TEXT,
      file_size INTEGER,
      file_type TEXT,
      status TEXT DEFAULT 'uploaded',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);

  // 预检问题表
  db.exec(`
    CREATE TABLE IF NOT EXISTS precheck_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      file_id INTEGER,
      issue_type TEXT,
      severity TEXT,
      description TEXT,
      expected_value TEXT,
      actual_value TEXT,
      status TEXT DEFAULT 'pending',
      resolved_at DATETIME,
      resolver TEXT,
      resolution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (file_id) REFERENCES upload_files(id)
    );
  `);

  // 改单记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      change_type TEXT,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      operator TEXT,
      stock_impact TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);

  // 排产记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedule_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      machine_id INTEGER,
      process_type TEXT,
      start_time DATETIME,
      end_time DATETIME,
      quantity INTEGER,
      status TEXT DEFAULT 'scheduled',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (machine_id) REFERENCES machines(id)
    );
  `);

  // 库存锁定记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      paper_id INTEGER NOT NULL,
      quantity REAL,
      is_released INTEGER DEFAULT 0,
      released_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (paper_id) REFERENCES paper_stock(id)
    );
  `);

  // 创建索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_pickup ON orders(pickup_time);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_precheck_status ON precheck_issues(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_schedule_time ON schedule_entries(start_time);`);
  
  return isNew;
}

function getDB() {
  if (!db) {
    initDB();
  }
  return db;
}

function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { initDB, getDB, closeDB, DB_PATH };
