const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'warehouse.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS parts (
          id TEXT PRIMARY KEY,
          part_code TEXT UNIQUE NOT NULL,
          part_name TEXT NOT NULL,
          stock_quantity INTEGER NOT NULL DEFAULT 0,
          unit TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS engineers (
          id TEXT PRIMARY KEY,
          engineer_code TEXT UNIQUE NOT NULL,
          engineer_name TEXT NOT NULL,
          phone TEXT,
          id_card TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS claims (
          id TEXT PRIMARY KEY,
          request_id TEXT UNIQUE NOT NULL,
          engineer_id TEXT NOT NULL,
          part_id TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          approved_at DATETIME,
          notes TEXT,
          FOREIGN KEY (engineer_id) REFERENCES engineers(id),
          FOREIGN KEY (part_id) REFERENCES parts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS installations (
          id TEXT PRIMARY KEY,
          request_id TEXT UNIQUE NOT NULL,
          claim_id TEXT NOT NULL,
          customer_name TEXT,
          customer_phone TEXT,
          customer_address TEXT,
          installation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          serial_number TEXT,
          notes TEXT,
          FOREIGN KEY (claim_id) REFERENCES claims(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS returns (
          id TEXT PRIMARY KEY,
          request_id TEXT UNIQUE NOT NULL,
          claim_id TEXT NOT NULL,
          part_id TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          condition TEXT NOT NULL,
          warehouse_keeper TEXT,
          notes TEXT,
          FOREIGN KEY (claim_id) REFERENCES claims(id),
          FOREIGN KEY (part_id) REFERENCES parts(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS vendor_claims (
          id TEXT PRIMARY KEY,
          request_id TEXT UNIQUE NOT NULL,
          return_id TEXT NOT NULL,
          vendor_name TEXT NOT NULL,
          claim_amount REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'submitted',
          submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          approved_at DATETIME,
          paid_at DATETIME,
          notes TEXT,
          FOREIGN KEY (return_id) REFERENCES returns(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS write_offs (
          id TEXT PRIMARY KEY,
          request_id TEXT UNIQUE NOT NULL,
          claim_id TEXT NOT NULL,
          write_off_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          reason TEXT NOT NULL,
          amount REAL NOT NULL,
          approved_by TEXT,
          notes TEXT,
          FOREIGN KEY (claim_id) REFERENCES claims(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          request_id TEXT,
          operator TEXT,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          id TEXT PRIMARY KEY,
          request_id TEXT UNIQUE NOT NULL,
          action TEXT NOT NULL,
          result TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      resolve();
    });
  });
};

const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

module.exports = { db, initDatabase, closeDatabase };
