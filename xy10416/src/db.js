const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS linen_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT NOT NULL UNIQUE,
      linen_type TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      received_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_stock',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wash_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      send_quantity INTEGER NOT NULL,
      send_date TEXT NOT NULL,
      return_quantity INTEGER,
      return_date TEXT,
      status TEXT NOT NULL DEFAULT 'sent',
      wash_factory TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      room_no TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      usage_date TEXT NOT NULL,
      returned_quantity INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'in_use',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS loss_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      loss_type TEXT NOT NULL,
      reason TEXT,
      apply_date TEXT NOT NULL,
      compensate_amount REAL DEFAULT 0,
      compensate_confirmed TEXT DEFAULT 'no',
      status TEXT NOT NULL DEFAULT 'pending',
      room_no TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      linen_type TEXT NOT NULL UNIQUE,
      total_stock INTEGER NOT NULL DEFAULT 0,
      in_stock INTEGER NOT NULL DEFAULT 0,
      in_wash INTEGER NOT NULL DEFAULT 0,
      in_use INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  console.log('数据库初始化完成');
});

module.exports = db;
