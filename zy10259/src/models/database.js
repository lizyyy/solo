const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './database/rental.db';

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
    db.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE NOT NULL,
      request_hash TEXT NOT NULL,
      response_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      spec TEXT,
      daily_rate REAL NOT NULL DEFAULT 0,
      deposit_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available',
      warehouse TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rental_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      actual_end_date DATE,
      total_days INTEGER NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      deposit_amount REAL NOT NULL DEFAULT 0,
      deposit_paid BOOLEAN DEFAULT 0,
      deposit_deducted REAL DEFAULT 0,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      equipment_code TEXT NOT NULL,
      daily_rate REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'reserved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES rental_orders(id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      lock_type TEXT NOT NULL,
      lock_reason TEXT,
      locked_by TEXT,
      locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      released_at DATETIME,
      is_active BOOLEAN DEFAULT 1,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id),
      FOREIGN KEY (order_id) REFERENCES rental_orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS outbounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outbound_no TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      warehouse TEXT NOT NULL,
      operator TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      outbound_date DATETIME,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES rental_orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS outbound_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outbound_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      equipment_code TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      confirmed BOOLEAN DEFAULT 0,
      FOREIGN KEY (outbound_id) REFERENCES outbounds(id),
      FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS extensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      extension_no TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      original_end_date DATE NOT NULL,
      new_end_date DATE NOT NULL,
      extension_days INTEGER NOT NULL,
      extension_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by TEXT,
      approved_at DATETIME,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      FOREIGN KEY (order_id) REFERENCES rental_orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange_no TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      old_equipment_id INTEGER NOT NULL,
      new_equipment_id INTEGER NOT NULL,
      old_equipment_code TEXT NOT NULL,
      new_equipment_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      old_released BOOLEAN DEFAULT 0,
      new_outbound BOOLEAN DEFAULT 0,
      exchange_date DATETIME,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES rental_orders(id),
      FOREIGN KEY (old_equipment_id) REFERENCES equipment(id),
      FOREIGN KEY (new_equipment_id) REFERENCES equipment(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      warehouse TEXT NOT NULL,
      operator TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      return_date DATETIME,
      damage_fee REAL DEFAULT 0,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES rental_orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      equipment_code TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      condition TEXT DEFAULT 'good',
      confirmed BOOLEAN DEFAULT 0,
      FOREIGN KEY (return_id) REFERENCES returns(id),
      FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS deposit_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_no TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      operator TEXT NOT NULL,
      reason TEXT,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES rental_orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_no TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL,
      bill_type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      due_date DATE,
      paid_date DATETIME,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES rental_orders(id)
    )`);

    console.log('数据库表初始化完成');
  });
}

module.exports = db;
