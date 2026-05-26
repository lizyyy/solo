const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'rental.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT UNIQUE NOT NULL,
      file_type TEXT NOT NULL,
      file_name TEXT,
      total_records INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      pending_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rental_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      order_no TEXT UNIQUE NOT NULL,
      device_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      rental_start_date DATE NOT NULL,
      rental_end_date DATE,
      daily_rent REAL NOT NULL DEFAULT 0,
      deposit_amount REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'active',
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS repair_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      repair_no TEXT UNIQUE NOT NULL,
      device_id TEXT NOT NULL,
      rental_order_no TEXT,
      repair_date DATE NOT NULL,
      repair_type TEXT,
      repair_cost REAL NOT NULL DEFAULT 0,
      liability TEXT,
      description TEXT,
      status TEXT DEFAULT 'pending',
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deposit_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      rule_code TEXT UNIQUE NOT NULL,
      rule_name TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      condition_expr TEXT,
      deduction_amount REAL DEFAULT 0,
      deduction_percent REAL DEFAULT 0,
      priority INTEGER DEFAULT 0,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deposit_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_no TEXT UNIQUE NOT NULL,
      batch_id TEXT,
      rental_order_no TEXT,
      repair_no TEXT,
      device_id TEXT,
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      balance REAL DEFAULT 0,
      reason TEXT,
      rule_code TEXT,
      source_type TEXT,
      source_id TEXT,
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS import_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      result_status TEXT NOT NULL,
      record_key TEXT,
      raw_data TEXT,
      error_message TEXT,
      suggestion TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rental_device ON rental_orders(device_id);
    CREATE INDEX IF NOT EXISTS idx_rental_customer ON rental_orders(customer_name);
    CREATE INDEX IF NOT EXISTS idx_repair_device ON repair_records(device_id);
    CREATE INDEX IF NOT EXISTS idx_repair_order ON repair_records(rental_order_no);
    CREATE INDEX IF NOT EXISTS idx_trans_order ON deposit_transactions(rental_order_no);
    CREATE INDEX IF NOT EXISTS idx_trans_device ON deposit_transactions(device_id);
    CREATE INDEX IF NOT EXISTS idx_batch_import ON import_results(batch_id);
  `);
}

module.exports = { db, initDatabase };
