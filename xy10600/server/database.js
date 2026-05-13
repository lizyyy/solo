const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'audit.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS price_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT NOT NULL,
      product_name TEXT,
      old_price REAL,
      new_price REAL,
      status TEXT NOT NULL,
      reason TEXT,
      operator TEXT,
      request_id TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS esl_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_change_id INTEGER,
      device_id TEXT NOT NULL,
      old_price REAL,
      new_price REAL,
      status TEXT NOT NULL,
      error_message TEXT,
      sent_at TEXT,
      synced_at TEXT,
      offline_at TEXT,
      FOREIGN KEY (price_change_id) REFERENCES price_changes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cashier_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_change_id INTEGER,
      terminal_id TEXT NOT NULL,
      old_price REAL,
      new_price REAL,
      status TEXT NOT NULL,
      error_message TEXT,
      applied_at TEXT,
      FOREIGN KEY (price_change_id) REFERENCES price_changes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_change_id INTEGER,
      promotion_id TEXT NOT NULL,
      promotion_name TEXT,
      rule_type TEXT,
      effect_start TEXT,
      effect_end TEXT,
      status TEXT,
      FOREIGN KEY (price_change_id) REFERENCES price_changes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rollback_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_change_id INTEGER,
      rollback_by TEXT,
      rollback_reason TEXT,
      esl_rolled_back INTEGER DEFAULT 0,
      cashier_rolled_back INTEGER DEFAULT 0,
      reissued_count INTEGER DEFAULT 0,
      rolled_back_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (price_change_id) REFERENCES price_changes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_change_id INTEGER,
      event_type TEXT NOT NULL,
      event_details TEXT,
      operator TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS price_discrepancies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_change_id INTEGER,
      esl_price REAL,
      cashier_price REAL,
      difference REAL,
      discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      status TEXT,
      FOREIGN KEY (price_change_id) REFERENCES price_changes(id)
    )
  `);
});

module.exports = db;
