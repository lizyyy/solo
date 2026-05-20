const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../park-security.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS visitors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        id_card TEXT,
        company TEXT,
        visit_purpose TEXT,
        visit_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        host_name TEXT NOT NULL,
        host_phone TEXT,
        host_department TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        license_plate TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS temporary_plates (
        id TEXT PRIMARY KEY,
        plate_number TEXT NOT NULL UNIQUE,
        visitor_id TEXT,
        vehicle_type TEXT NOT NULL,
        driver_name TEXT,
        driver_phone TEXT,
        valid_from TEXT NOT NULL,
        valid_to TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS blacklist (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        identifier TEXT NOT NULL,
        name TEXT,
        reason TEXT NOT NULL,
        added_by TEXT NOT NULL,
        added_at TEXT NOT NULL,
        expires_at TEXT,
        status TEXT NOT NULL DEFAULT 'active'
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS verification_records (
        id TEXT PRIMARY KEY,
        verification_type TEXT NOT NULL,
        identifier TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        license_plate TEXT,
        visitor_id TEXT,
        status TEXT NOT NULL,
        result TEXT NOT NULL,
        reason TEXT NOT NULL,
        operator TEXT NOT NULL,
        gate TEXT,
        created_at TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS batch_operations (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        total_count INTEGER NOT NULL,
        success_count INTEGER NOT NULL DEFAULT 0,
        fail_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'processing',
        started_by TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        error_summary TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS batch_operation_items (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        item_identifier TEXT NOT NULL,
        item_data TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        processed_at TEXT,
        FOREIGN KEY (batch_id) REFERENCES batch_operations(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_visitors_date ON visitors(visit_date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_blacklist_identifier ON blacklist(identifier)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_verification_time ON verification_records(created_at)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_records(status)`);
    }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { db, initDatabase };
