const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'unsubscribe.db');
let db;

try {
  db = new sqlite3.Database(dbPath);
} catch (err) {
  console.error('数据库打开失败，尝试重建:', err.message);
  db = new sqlite3.Database(dbPath);
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS unsubscribe_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_normalized TEXT NOT NULL,
        phone_original TEXT NOT NULL,
        channel TEXT NOT NULL,
        unsubscribe_time DATETIME NOT NULL,
        marketing_batch TEXT,
        status TEXT DEFAULT 'active',
        source_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(phone_normalized, channel)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS block_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_normalized TEXT NOT NULL,
        block_time DATETIME NOT NULL,
        marketing_batch TEXT,
        campaign_id TEXT,
        block_reason TEXT,
        original_request TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS unsubscribe_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT NOT NULL UNIQUE,
        channel TEXT NOT NULL,
        total_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'processing',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        created_by TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS exception_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT,
        phone_original TEXT NOT NULL,
        channel TEXT,
        error_type TEXT NOT NULL,
        error_message TEXT,
        original_input TEXT,
        process_log TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        handled_at DATETIME,
        handled_by TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS manual_corrections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unsubscribe_id INTEGER,
        phone_normalized TEXT,
        correction_type TEXT NOT NULL,
        before_value TEXT,
        after_value TEXT,
        reason TEXT NOT NULL,
        operator TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_phone_normalized ON unsubscribe_records(phone_normalized)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_status ON unsubscribe_records(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batch_no ON unsubscribe_batches(batch_no)`);
    });
    
    resolve();
  });
}

module.exports = { db, initDatabase };
