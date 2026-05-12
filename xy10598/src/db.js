const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config.json');

let db = null;

function getDbPath(workDir) {
  return path.join(workDir, config.database.fileName);
}

function initialize(workDir) {
  const dbPath = getDbPath(workDir);
  
  if (fs.existsSync(dbPath)) {
    throw new Error(`数据库已存在: ${dbPath}。如需重新初始化，请先备份或删除现有数据。`);
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  createIndexes();
  initializeMetadata();
  
  db.close();
  
  return {
    path: dbPath,
    message: '数据库初始化成功'
  };
}

function connect(workDir) {
  const dbPath = getDbPath(workDir);
  
  if (!fs.existsSync(dbPath)) {
    throw new Error(`数据库不存在: ${dbPath}。请先运行 init 命令初始化。`);
  }
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('数据库未连接。请先调用 connect() 或 initialize()');
  }
  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

function createTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_code TEXT UNIQUE NOT NULL,
      store_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_code TEXT UNIQUE NOT NULL,
      staff_name TEXT NOT NULL,
      store_code TEXT NOT NULL,
      role TEXT DEFAULT '导购',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT NOT NULL,
      base_commission_rate REAL DEFAULT 0.02,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promotion_code TEXT UNIQUE NOT NULL,
      promotion_name TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      commission_multiplier REAL DEFAULT 1.0,
      applies_to_category TEXT,
      applies_to_sku TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      order_date DATE NOT NULL,
      store_code TEXT NOT NULL,
      customer_phone TEXT,
      total_amount REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      payment_method TEXT,
      status TEXT DEFAULT 'completed',
      promotion_code TEXT,
      source_store_code TEXT,
      is_transfer_sale INTEGER DEFAULT 0,
      import_batch TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL,
      line_no INTEGER NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      discount REAL DEFAULT 0,
      line_net_amount REAL NOT NULL,
      commission_rate REAL DEFAULT 0.02,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_no) REFERENCES sales_orders(order_no)
    );

    CREATE TABLE IF NOT EXISTS staff_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL,
      staff_code TEXT NOT NULL,
      allocation_ratio REAL NOT NULL,
      allocation_type TEXT DEFAULT 'normal',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_no) REFERENCES sales_orders(order_no)
    );

    CREATE TABLE IF NOT EXISTS return_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      original_order_no TEXT,
      return_date DATE NOT NULL,
      store_code TEXT NOT NULL,
      total_amount REAL NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'completed',
      import_batch TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS store_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_no TEXT UNIQUE NOT NULL,
      transfer_date DATE NOT NULL,
      from_store_code TEXT NOT NULL,
      to_store_code TEXT NOT NULL,
      sku TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      sale_order_no TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS commission_calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calculation_id TEXT NOT NULL,
      staff_code TEXT NOT NULL,
      order_no TEXT,
      return_no TEXT,
      period TEXT NOT NULL,
      base_amount REAL NOT NULL,
      commission_amount REAL NOT NULL,
      commission_type TEXT NOT NULL,
      calculation_rule TEXT NOT NULL,
      deduction_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS import_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT UNIQUE NOT NULL,
      import_type TEXT NOT NULL,
      file_name TEXT,
      record_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'processing',
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS import_failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      record_no INTEGER,
      error_message TEXT NOT NULL,
      record_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS manual_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adjustment_no TEXT UNIQUE NOT NULL,
      staff_code TEXT NOT NULL,
      period TEXT NOT NULL,
      original_amount REAL NOT NULL,
      adjusted_amount REAL NOT NULL,
      difference REAL NOT NULL,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      table_name TEXT,
      record_id TEXT,
      before_value TEXT,
      after_value TEXT,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS calculation_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      last_calculated_at DATETIME,
      calculation_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(sql);
}

function createIndexes() {
  const indexes = [
    'CREATE INDEX idx_sales_order_date ON sales_orders(order_date)',
    'CREATE INDEX idx_sales_store ON sales_orders(store_code)',
    'CREATE INDEX idx_return_date ON return_orders(return_date)',
    'CREATE INDEX idx_alloc_order ON staff_allocations(order_no)',
    'CREATE INDEX idx_alloc_staff ON staff_allocations(staff_code)',
    'CREATE INDEX idx_transfer_sku ON store_transfers(sku)',
    'CREATE INDEX idx_comm_staff ON commission_calculations(staff_code)',
    'CREATE INDEX idx_comm_period ON commission_calculations(period)',
  ];
  
  indexes.forEach(sql => {
    try {
      db.exec(sql);
    } catch (e) {
    }
  });
}

function initializeMetadata() {
  const stmt = db.prepare('INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)');
  stmt.run('version', '1.0.0');
  stmt.run('initialized_at', new Date().toISOString());
}

module.exports = {
  initialize,
  connect,
  getDb,
  close,
  getDbPath
};
