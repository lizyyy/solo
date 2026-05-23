const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/pricetag.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_code TEXT UNIQUE NOT NULL,
      store_name TEXT NOT NULL,
      address TEXT,
      manager TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      category TEXT,
      base_price DECIMAL(10,2) NOT NULL,
      unit TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS price_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_code TEXT UNIQUE NOT NULL,
      version_name TEXT NOT NULL,
      barcode TEXT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      price_type TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      effective_start DATETIME,
      effective_end DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (barcode) REFERENCES products(barcode)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS promotion_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promotion_code TEXT UNIQUE NOT NULL,
      promotion_name TEXT NOT NULL,
      price_version_id INTEGER,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      store_codes TEXT,
      status TEXT DEFAULT 'scheduled',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (price_version_id) REFERENCES price_versions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      confirmation_code TEXT UNIQUE NOT NULL,
      store_code TEXT NOT NULL,
      price_version_id INTEGER NOT NULL,
      confirmer TEXT NOT NULL,
      confirmation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'confirmed',
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_code) REFERENCES stores(store_code),
      FOREIGN KEY (price_version_id) REFERENCES price_versions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS discrepancy_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_code TEXT UNIQUE NOT NULL,
      store_code TEXT NOT NULL,
      barcode TEXT NOT NULL,
      price_version_id INTEGER,
      expected_price DECIMAL(10,2),
      actual_price DECIMAL(10,2),
      discrepancy_type TEXT,
      status TEXT DEFAULT 'pending_review',
      reported_by TEXT,
      reviewed_by TEXT,
      review_time DATETIME,
      resolution TEXT,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_code) REFERENCES stores(store_code),
      FOREIGN KEY (barcode) REFERENCES products(barcode)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exception_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exception_code TEXT UNIQUE NOT NULL,
      api_endpoint TEXT,
      original_input TEXT,
      error_message TEXT,
      processing_conclusion TEXT,
      status TEXT DEFAULT 'pending',
      handled_by TEXT,
      handled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correction_code TEXT UNIQUE NOT NULL,
      discrepancy_id INTEGER,
      store_code TEXT,
      barcode TEXT,
      old_price DECIMAL(10,2),
      new_price DECIMAL(10,2),
      corrected_by TEXT NOT NULL,
      correction_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (discrepancy_id) REFERENCES discrepancy_reports(id)
    )`);

    console.log('数据表初始化完成');
  });
}

module.exports = db;
