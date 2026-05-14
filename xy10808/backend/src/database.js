const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/signature.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS merchant_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id TEXT UNIQUE NOT NULL,
      merchant_name TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      algorithm TEXT DEFAULT 'HMAC-SHA256',
      time_window INTEGER DEFAULT 300,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS signature_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id TEXT UNIQUE NOT NULL,
      merchant_id TEXT NOT NULL,
      original_payload TEXT NOT NULL,
      signature TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      nonce TEXT,
      status TEXT DEFAULT 'PENDING',
      verify_result TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchant_configs(merchant_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sample_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sample_id TEXT UNIQUE NOT NULL,
      record_id TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      signature TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      expected_signature TEXT,
      is_success INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES signature_records(record_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS verification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id TEXT NOT NULL,
      status_before TEXT NOT NULL,
      status_after TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES signature_records(record_id)
    )
  `);
});

module.exports = db;
