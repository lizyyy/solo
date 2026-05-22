const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'customer_service.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        batch_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        handler TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        order_no TEXT UNIQUE NOT NULL,
        charger_id TEXT,
        start_time DATETIME,
        end_time DATETIME,
        duration INTEGER,
        electricity REAL,
        amount REAL,
        payment_channel TEXT,
        platform TEXT,
        user_id TEXT,
        car_no TEXT,
        raw_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS charger_logs (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        log_no TEXT,
        charger_id TEXT,
        event_type TEXT,
        event_time DATETIME,
        gun_no TEXT,
        start_kwh REAL,
        end_kwh REAL,
        status TEXT,
        error_code TEXT,
        raw_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS payment_receipts (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        receipt_no TEXT UNIQUE NOT NULL,
        order_no TEXT,
        transaction_id TEXT,
        amount REAL,
        payment_method TEXT,
        payment_time DATETIME,
        status TEXT,
        raw_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS processing_records (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        batch_id TEXT,
        status TEXT NOT NULL,
        handler TEXT NOT NULL,
        reason TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS exception_records (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        batch_id TEXT,
        exception_type TEXT NOT NULL,
        description TEXT,
        handler TEXT,
        status TEXT DEFAULT 'open',
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        operator TEXT NOT NULL,
        operation TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        detail TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_charger ON orders(charger_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_channel)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_processing_handler ON processing_records(handler)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_exception_type ON exception_records(exception_type)`);
      
      resolve();
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runInsert(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

function runUpdate(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

module.exports = {
  db,
  initDatabase,
  runQuery,
  runInsert,
  runUpdate
};
