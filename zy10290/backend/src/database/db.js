const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'flash_sale.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS flash_sale_activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS flash_sale_products (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      original_price DECIMAL(10,2) NOT NULL,
      flash_price DECIMAL(10,2) NOT NULL,
      total_stock INTEGER NOT NULL DEFAULT 0,
      available_stock INTEGER NOT NULL DEFAULT 0,
      locked_stock INTEGER NOT NULL DEFAULT 0,
      sold_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (activity_id) REFERENCES flash_sale_activities(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS flash_sale_orders (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      order_no TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_phone TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_time DATETIME,
      payment_transaction_id TEXT UNIQUE,
      shipping_status TEXT NOT NULL DEFAULT 'unshipped',
      shipping_time DATETIME,
      shipping_tracking_no TEXT,
      refund_status TEXT NOT NULL DEFAULT 'none',
      refund_time DATETIME,
      refund_amount DECIMAL(10,2),
      is_manual_compensation BOOLEAN NOT NULL DEFAULT 0,
      compensation_apply_time DATETIME,
      compensation_approve_time DATETIME,
      compensation_reject_time DATETIME,
      compensation_reject_reason TEXT,
      operator_id TEXT,
      operator_name TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (activity_id) REFERENCES flash_sale_activities(id),
      FOREIGN KEY (product_id) REFERENCES flash_sale_products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_change_logs (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      order_id TEXT,
      change_type TEXT NOT NULL,
      change_quantity INTEGER NOT NULL,
      before_stock INTEGER NOT NULL,
      after_stock INTEGER NOT NULL,
      operator_id TEXT,
      operator_name TEXT,
      remark TEXT,
      idempotent_key TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES flash_sale_products(id),
      FOREIGN KEY (order_id) REFERENCES flash_sale_orders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_applications (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      applicant_id TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      apply_reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_id TEXT,
      reviewer_name TEXT,
      review_remark TEXT,
      review_time DATETIME,
      idempotent_key TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES flash_sale_orders(id)
    )
  `);
});

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

module.exports = { db, all, get, run };
