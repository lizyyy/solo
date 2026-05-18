const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/cache_degrade.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS degrade_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL,
    business_line TEXT NOT NULL,
    degrade_reason TEXT NOT NULL,
    executor TEXT NOT NULL,
    status TEXT DEFAULT 'degraded',
    restore_time DATETIME,
    restore_applicant TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cleanup_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    degrade_record_id INTEGER NOT NULL,
    cache_key TEXT NOT NULL,
    hit_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    confirmed_by TEXT,
    FOREIGN KEY (degrade_record_id) REFERENCES degrade_records(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cache_hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL,
    hit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    value_type TEXT,
    is_null_cache INTEGER DEFAULT 0
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_degrade_status ON degrade_records(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_degrade_key ON degrade_records(cache_key)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cleanup_status ON cleanup_tasks(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cache_hits_key ON cache_hits(cache_key)`);
});

module.exports = db;