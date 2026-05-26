const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

const dbDir = path.dirname(path.resolve(config.dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(path.resolve(config.dbPath));

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_code TEXT UNIQUE NOT NULL,
        store_name TEXT NOT NULL,
        address TEXT,
        contact TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_code TEXT UNIQUE NOT NULL,
        package_name TEXT NOT NULL,
        package_type TEXT NOT NULL,
        original_price REAL DEFAULT 0,
        sale_price REAL DEFAULT 0,
        validity_start DATE,
        validity_end DATE,
        description TEXT,
        items TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS work_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE NOT NULL,
        store_code TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        plate_number TEXT,
        vehicle_model TEXT,
        package_code TEXT,
        order_amount REAL DEFAULT 0,
        actual_amount REAL DEFAULT 0,
        order_status TEXT DEFAULT 'pending',
        order_date DATE,
        items TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_code TEXT UNIQUE NOT NULL,
        part_name TEXT NOT NULL,
        part_type TEXT,
        unit TEXT DEFAULT '个',
        unit_price REAL DEFAULT 0,
        stock_quantity INTEGER DEFAULT 0,
        safe_stock INTEGER DEFAULT 10,
        supplier TEXT,
        store_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        batch_type TEXT NOT NULL,
        store_code TEXT,
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        source_file TEXT,
        operator TEXT NOT NULL,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS batch_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        item_type TEXT NOT NULL,
        item_code TEXT,
        item_data TEXT,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        process_result TEXT,
        operator TEXT,
        processed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,
        module TEXT NOT NULL,
        relation_id INTEGER,
        relation_code TEXT,
        store_code TEXT,
        operator TEXT NOT NULL,
        operation_reason TEXT,
        old_value TEXT,
        new_value TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS stock_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_code TEXT NOT NULL,
        store_code TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        balance_before INTEGER,
        balance_after INTEGER,
        unit_price REAL,
        total_amount REAL,
        relation_type TEXT,
        relation_id INTEGER,
        operator TEXT NOT NULL,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_packages_code ON packages(package_code)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_no ON work_orders(order_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_store ON work_orders(store_code)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_parts_code ON parts(part_code)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batches_no ON batches(batch_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_logs_module ON operation_logs(module, relation_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_logs_code ON operation_logs(relation_code)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_stock_part ON stock_transactions(part_code, store_code)`);

      resolve();
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDatabase,
  runQuery,
  getOne,
  getAll
};
