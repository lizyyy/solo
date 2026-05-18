const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'uniform_exchange.db');
const db = new sqlite3.Database(dbPath);

function initTables(callback) {
  const sql = `
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      class_name TEXT NOT NULL,
      gender TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS uniform_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      season TEXT NOT NULL,
      type TEXT NOT NULL,
      base_price DECIMAL(10,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS uniform_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      size_code TEXT NOT NULL,
      size_name TEXT NOT NULL,
      suggested_height TEXT,
      suggested_weight TEXT,
      FOREIGN KEY (product_id) REFERENCES uniform_products(id),
      UNIQUE(product_id, size_code)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      size_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (size_id) REFERENCES uniform_sizes(id),
      UNIQUE(size_id)
    );

    CREATE TABLE IF NOT EXISTS original_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      student_id INTEGER NOT NULL,
      size_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      order_date DATE NOT NULL,
      receive_date DATE,
      status TEXT NOT NULL DEFAULT '已领取',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (size_id) REFERENCES uniform_sizes(id)
    );

    CREATE TABLE IF NOT EXISTS exchange_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange_no TEXT UNIQUE NOT NULL,
      original_order_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      from_size_id INTEGER NOT NULL,
      to_size_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      reason_detail TEXT,
      contact_phone TEXT,
      status TEXT NOT NULL DEFAULT '待审核',
      reject_reason TEXT,
      supplementary_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (original_order_id) REFERENCES original_orders(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (from_size_id) REFERENCES uniform_sizes(id),
      FOREIGN KEY (to_size_id) REFERENCES uniform_sizes(id)
    );

    CREATE INDEX IF NOT EXISTS idx_exchange_student ON exchange_orders(student_id);
    CREATE INDEX IF NOT EXISTS idx_exchange_status ON exchange_orders(status);
    CREATE INDEX IF NOT EXISTS idx_exchange_created ON exchange_orders(created_at);
  `;
  
  db.exec(sql, callback);
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { db, initTables, run, get, all };
