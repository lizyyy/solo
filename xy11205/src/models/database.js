const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../database/pharmacy.db');
const db = new Database(dbPath);

function initializeDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    
    CREATE TABLE IF NOT EXISTS arrival_orders (
      id TEXT PRIMARY KEY,
      batch_number TEXT NOT NULL,
      product_type TEXT NOT NULL CHECK (product_type IN ('vaccine', 'insulin')),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      arrival_date TEXT NOT NULL,
      receiver TEXT NOT NULL,
      signature TEXT NOT NULL,
      damage_status TEXT DEFAULT 'none',
      damage_description TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'rejected')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      operator TEXT NOT NULL,
      role TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS temperature_records (
      id TEXT PRIMARY KEY,
      arrival_order_id TEXT NOT NULL,
      temperature REAL NOT NULL,
      record_time TEXT NOT NULL,
      recorder TEXT NOT NULL,
      is_valid INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      operator TEXT NOT NULL,
      role TEXT NOT NULL,
      FOREIGN KEY (arrival_order_id) REFERENCES arrival_orders(id)
    );
    
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      arrival_order_id TEXT NOT NULL,
      photo_path TEXT NOT NULL,
      photo_type TEXT NOT NULL CHECK (photo_type IN ('package', 'damage', 'receipt')),
      upload_time TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      operator TEXT NOT NULL,
      role TEXT NOT NULL,
      FOREIGN KEY (arrival_order_id) REFERENCES arrival_orders(id)
    );
    
    CREATE TABLE IF NOT EXISTS import_errors (
      id TEXT PRIMARY KEY,
      import_type TEXT NOT NULL,
      source_file TEXT NOT NULL,
      row_number INTEGER,
      raw_data TEXT NOT NULL,
      error_message TEXT NOT NULL,
      suggestion TEXT,
      created_at TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      resolved_by TEXT
    );
    
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      table_name TEXT,
      record_id TEXT,
      old_values TEXT,
      new_values TEXT,
      operator TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function getDatabase() {
  return db;
}

module.exports = {
  initializeDatabase,
  getDatabase
};
