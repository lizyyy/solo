const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');

const dbPath = path.join(__dirname, '..', 'parking.db');
const db = new sqlite3.Database(dbPath);

db.run = promisify(db.run);
db.get = promisify(db.get);
db.all = promisify(db.all);
db.exec = promisify(db.exec);

async function initDatabase() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS parking_spots (
      id TEXT PRIMARY KEY,
      spot_number TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      price_per_hour REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      spot_id TEXT NOT NULL,
      spot_number TEXT NOT NULL,
      renter_id TEXT NOT NULL,
      renter_name TEXT NOT NULL,
      license_plate TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at INTEGER,
      payment_method TEXT,
      payment_transaction_id TEXT UNIQUE,
      authorized_at INTEGER,
      cancelled_at INTEGER,
      refunded_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (spot_id) REFERENCES parking_spots(id)
    );

    CREATE TABLE IF NOT EXISTS access_authorizations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      license_plate TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      revoked_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      settled_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT,
      operation TEXT NOT NULL,
      operator_id TEXT,
      operator_name TEXT,
      details TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_spot_time ON orders(spot_id, start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_orders_license_plate ON orders(license_plate, status);
    CREATE INDEX IF NOT EXISTS idx_authorizations_status ON access_authorizations(status);
  `);
}

module.exports = { db, initDatabase };
