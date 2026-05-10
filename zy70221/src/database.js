const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DATA_DIR, DB_PATH } = require('./config');

function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT,
      price REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      batch_number TEXT,
      expiry_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(location_id, product_id, batch_number, expiry_date),
      FOREIGN KEY (location_id) REFERENCES locations(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS expiry_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_number TEXT,
      expiry_date TEXT,
      scan_date TEXT NOT NULL,
      source TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (location_id) REFERENCES locations(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS transfer_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_location_id TEXT NOT NULL,
      to_location_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_number TEXT,
      expiry_date TEXT,
      quantity INTEGER NOT NULL,
      suggested_action TEXT,
      suggested_price REAL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (from_location_id) REFERENCES locations(id),
      FOREIGN KEY (to_location_id) REFERENCES locations(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS check_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date TEXT NOT NULL,
      total_locations INTEGER,
      total_products INTEGER,
      expiring_items INTEGER,
      critical_items INTEGER,
      transfer_suggestions INTEGER,
      price_adjustments INTEGER,
      issues_found INTEGER,
      passed INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS check_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_run_id INTEGER NOT NULL,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      location_id TEXT,
      product_id TEXT,
      batch_number TEXT,
      message TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (check_run_id) REFERENCES check_runs(id)
    );

    CREATE TABLE IF NOT EXISTS import_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      record_type TEXT NOT NULL,
      total_records INTEGER,
      successful_records INTEGER,
      failed_records INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

function getDb() {
  return new Database(DB_PATH);
}

function databaseExists() {
  return fs.existsSync(DB_PATH);
}

module.exports = {
  initDatabase,
  getDb,
  databaseExists
};
