const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

let db = null;

function getDataDir() {
  return path.join(__dirname, '..', 'data');
}

function getDbPath() {
  return path.join(getDataDir(), 'rental.db');
}

function ensureDataDir() {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    ensureDataDir();
    
    if (db) {
      return resolve(db);
    }

    db = new sqlite3.Database(getDbPath(), (err) => {
      if (err) {
        return reject(err);
      }
    });

    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS import_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id TEXT UNIQUE NOT NULL,
          file_type TEXT NOT NULL,
          file_name TEXT,
          total_records INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          pending_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS rental_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id TEXT NOT NULL,
          order_no TEXT UNIQUE NOT NULL,
          device_id TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT,
          rental_start_date DATE NOT NULL,
          rental_end_date DATE,
          daily_rent REAL NOT NULL DEFAULT 0,
          deposit_amount REAL NOT NULL DEFAULT 0,
          status TEXT DEFAULT 'active',
          raw_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS repair_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id TEXT NOT NULL,
          repair_no TEXT UNIQUE NOT NULL,
          device_id TEXT NOT NULL,
          rental_order_no TEXT,
          repair_date DATE NOT NULL,
          repair_type TEXT,
          repair_cost REAL NOT NULL DEFAULT 0,
          liability TEXT,
          description TEXT,
          status TEXT DEFAULT 'pending',
          raw_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS deposit_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id TEXT NOT NULL,
          rule_code TEXT UNIQUE NOT NULL,
          rule_name TEXT NOT NULL,
          rule_type TEXT NOT NULL,
          condition_expr TEXT,
          deduction_amount REAL DEFAULT 0,
          deduction_percent REAL DEFAULT 0,
          priority INTEGER DEFAULT 0,
          description TEXT,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS deposit_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_no TEXT UNIQUE NOT NULL,
          batch_id TEXT,
          rental_order_no TEXT,
          repair_no TEXT,
          device_id TEXT,
          transaction_type TEXT NOT NULL,
          amount REAL NOT NULL DEFAULT 0,
          balance REAL DEFAULT 0,
          reason TEXT,
          rule_code TEXT,
          source_type TEXT,
          source_id TEXT,
          status TEXT DEFAULT 'confirmed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS import_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id TEXT NOT NULL,
          record_type TEXT NOT NULL,
          result_status TEXT NOT NULL,
          record_key TEXT,
          raw_data TEXT,
          error_message TEXT,
          suggestion TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function prepare(sql) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return {
    run: (...params) => new Promise((resolve, reject) => {
      stmt.run(...params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    }),
    get: (...params) => new Promise((resolve, reject) => {
      stmt.get(...params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    }),
    all: (...params) => new Promise((resolve, reject) => {
      stmt.all(...params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    })
  };
}

module.exports = { getDb, initDatabase, run, get, all, prepare };
