const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function getDbPath() {
  const configDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, 'inspector.db');
}

function getDb() {
  if (!db) {
    const dbPath = getDbPath();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function initDb() {
  const database = getDb();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('entry', 'review', 'manager', 'readonly')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS data_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('delivery', 'weight', 'return_basket', 'price_adjust')),
      file_path TEXT NOT NULL,
      imported_by INTEGER REFERENCES users(id),
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      hash TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fact_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER REFERENCES data_sources(id),
      source_type TEXT NOT NULL,
      original_line_number INTEGER,
      supplier_name TEXT,
      product_name TEXT,
      product_code TEXT,
      batch_no TEXT,
      delivery_date DATE,
      delivery_quantity REAL,
      delivery_weight REAL,
      sorted_quantity REAL,
      sorted_weight REAL,
      loss_quantity REAL,
      loss_weight REAL,
      loss_reason TEXT,
      unit_price REAL,
      total_amount REAL,
      is_bad_fruit INTEGER DEFAULT 0,
      bad_fruit_amount REAL,
      second_sort_loss REAL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'fixed', 'rejected')),
      unique_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(unique_key)
    );

    CREATE TABLE IF NOT EXISTS dirty_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_id INTEGER REFERENCES fact_records(id),
      source_id INTEGER REFERENCES data_sources(id),
      error_type TEXT NOT NULL CHECK (error_type IN ('missing_field', 'cross_date', 'name_change', 'amount_conflict', 'quantity_conflict')),
      error_message TEXT NOT NULL,
      original_data TEXT NOT NULL,
      fixed_data TEXT,
      fix_note TEXT,
      fixed_by INTEGER REFERENCES users(id),
      fixed_at DATETIME,
      status TEXT DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'ignored')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS operation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      table_name TEXT,
      record_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_fact_unique_key ON fact_records(unique_key);
    CREATE INDEX IF NOT EXISTS idx_fact_source_type ON fact_records(source_type);
    CREATE INDEX IF NOT EXISTS idx_fact_delivery_date ON fact_records(delivery_date);
    CREATE INDEX IF NOT EXISTS idx_dirty_error_type ON dirty_records(error_type);
    CREATE INDEX IF NOT EXISTS idx_dirty_status ON dirty_records(status);
    CREATE INDEX IF NOT EXISTS idx_history_action ON operation_history(action);
  `);

  const checkAdmin = database.prepare('SELECT COUNT(*) as count FROM users WHERE username = ?');
  const result = checkAdmin.get('admin');
  if (result.count === 0) {
    const insertAdmin = database.prepare(`
      INSERT INTO users (username, password_hash, role) 
      VALUES (?, ?, ?)
    `);
    insertAdmin.run('admin', 'admin123', 'manager');
  }

  return database;
}

module.exports = {
  getDb,
  closeDb,
  initDb,
  getDbPath
};
