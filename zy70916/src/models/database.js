const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/nursing-station.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
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

function initDatabase() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_count INTEGER DEFAULT 0,
      processed_count INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS elderly_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      elderly_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      gender TEXT,
      age INTEGER,
      id_card TEXT,
      phone TEXT,
      address TEXT,
      district TEXT,
      health_status TEXT,
      care_level TEXT,
      requirements TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nurses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nurse_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      gender TEXT,
      phone TEXT,
      qualifications TEXT,
      skills TEXT,
      district TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS service_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      batch_id INTEGER,
      elderly_id TEXT NOT NULL,
      nurse_id TEXT,
      service_type TEXT NOT NULL,
      service_items TEXT,
      scheduled_date TEXT,
      scheduled_time TEXT,
      address TEXT,
      district TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      skill_match_status TEXT,
      route_status TEXT,
      distance_km REAL,
      cancel_reason TEXT,
      replacement_nurse_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS track_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT UNIQUE NOT NULL,
      service_order_id INTEGER NOT NULL,
      batch_id INTEGER,
      elderly_id TEXT,
      nurse_id TEXT,
      service_type TEXT,
      status TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      handled_by TEXT NOT NULL,
      handled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      source_type TEXT,
      source_id TEXT,
      route_info TEXT,
      skill_info TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  return Promise.all(tables.map(sql => run(sql)));
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase
};
