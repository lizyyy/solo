const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS device_heartbeats (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_name TEXT,
        status TEXT NOT NULL,
        voltage REAL,
        current REAL,
        temperature REAL,
        previous_status TEXT,
        previous_voltage REAL,
        previous_current REAL,
        previous_temperature REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS charging_orders (
        id TEXT PRIMARY KEY,
        order_no TEXT NOT NULL UNIQUE,
        device_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        start_time DATETIME,
        end_time DATETIME,
        charged_kwh REAL,
        amount REAL,
        status TEXT NOT NULL,
        payment_status TEXT,
        previous_status TEXT,
        previous_amount REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS remote_restarts (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        operator TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL,
        previous_status TEXT,
        restart_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS repair_tickets (
        id TEXT PRIMARY KEY,
        ticket_no TEXT NOT NULL UNIQUE,
        device_id TEXT NOT NULL,
        order_id TEXT,
        reporter TEXT NOT NULL,
        assignee TEXT,
        issue_type TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium',
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS payment_failures (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        failure_code TEXT,
        failure_reason TEXT,
        retry_count INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS refund_progress (
        id TEXT PRIMARY KEY,
        refund_no TEXT NOT NULL UNIQUE,
        order_id TEXT NOT NULL,
        ticket_id TEXT,
        amount REAL NOT NULL,
        reason TEXT,
        status TEXT NOT NULL,
        operator TEXT,
        reviewer TEXT,
        review_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        idempotency_key TEXT UNIQUE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        operator TEXT NOT NULL,
        action TEXT NOT NULL,
        module TEXT NOT NULL,
        record_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      resolve();
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = { db, initDatabase, run, get, all, uuidv4 };
