const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/farm.db');
let db;

const init = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else {
        createTables().then(resolve).catch(reject);
      }
    });
  });
};

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS orchard_batches (
        id TEXT PRIMARY KEY,
        orchard_name TEXT NOT NULL,
        fruit_type TEXT NOT NULL,
        batch_code TEXT UNIQUE NOT NULL,
        planned_date TEXT NOT NULL,
        estimated_yield REAL NOT NULL,
        remaining_yield REAL NOT NULL,
        unit TEXT DEFAULT 'kg',
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS weather_delays (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        delay_reason TEXT NOT NULL,
        original_date TEXT NOT NULL,
        new_date TEXT NOT NULL,
        weather_type TEXT,
        impact_level TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES orchard_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        quantity REAL NOT NULL,
        appointment_date TEXT NOT NULL,
        time_slot TEXT,
        status TEXT DEFAULT 'pending',
        verified_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES orchard_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reschedule_records (
        id TEXT PRIMARY KEY,
        appointment_id TEXT NOT NULL,
        original_date TEXT NOT NULL,
        new_date TEXT NOT NULL,
        reason TEXT NOT NULL,
        operator TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TEXT,
        review_notes TEXT,
        idempotency_key TEXT UNIQUE,
        failure_reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS yield_limits (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        limit_type TEXT NOT NULL,
        threshold REAL NOT NULL,
        current_value REAL NOT NULL,
        is_exceeded INTEGER DEFAULT 0,
        alert_level TEXT DEFAULT 'warning',
        resolved_at TEXT,
        resolved_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES orchard_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        sent_at TEXT,
        read_at TEXT,
        recipient TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS refund_rules (
        id TEXT PRIMARY KEY,
        rule_name TEXT NOT NULL,
        days_before_appointment INTEGER NOT NULL,
        refund_rate REAL NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS timeline (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT NOT NULL,
        operator TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
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

module.exports = { init, run, get, all };
