const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'repair_data.db');

let db = null;

function initDatabase() {
  db = new Database(DB_PATH);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS repair_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      body_serial TEXT NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      camera_model TEXT,
      problem_description TEXT,
      receive_date TEXT,
      estimated_cost REAL,
      status TEXT DEFAULT 'pending',
      notified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shutter_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id TEXT UNIQUE NOT NULL,
      body_serial TEXT NOT NULL,
      test_date TEXT,
      shutter_count INTEGER,
      shutter_speed TEXT,
      accuracy_result TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accessories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id TEXT UNIQUE NOT NULL,
      body_serial TEXT NOT NULL,
      part_name TEXT,
      part_number TEXT,
      ordered_date TEXT,
      arrived_date TEXT,
      quantity INTEGER DEFAULT 1,
      cost REAL,
      status TEXT DEFAULT 'ordered',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS repair_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id TEXT UNIQUE NOT NULL,
      body_serial TEXT NOT NULL,
      file_path TEXT,
      file_name TEXT,
      photo_type TEXT,
      taken_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anomaly_type TEXT NOT NULL,
      body_serial TEXT,
      description TEXT,
      reference_id TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_repair_orders_serial ON repair_orders(body_serial);
    CREATE INDEX IF NOT EXISTS idx_shutter_tests_serial ON shutter_tests(body_serial);
    CREATE INDEX IF NOT EXISTS idx_accessories_serial ON accessories(body_serial);
    CREATE INDEX IF NOT EXISTS idx_repair_photos_serial ON repair_photos(body_serial);
    CREATE INDEX IF NOT EXISTS idx_anomalies_serial ON anomalies(body_serial);
  `);

  return db;
}

function getDatabase() {
  if (!db) {
    initDatabase();
  }
  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

function resetDatabase() {
  if (db) {
    db.close();
  }
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  db = null;
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
  resetDatabase,
  DB_PATH
};
