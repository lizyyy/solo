const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'rental.db');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    item_type TEXT NOT NULL,
    item_name TEXT NOT NULL,
    deposit_amount REAL NOT NULL,
    rent_amount REAL NOT NULL,
    rent_unit TEXT NOT NULL,
    start_date TEXT NOT NULL,
    expected_return_date TEXT NOT NULL,
    actual_return_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    remark TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    tx_type TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL,
    description TEXT,
    operator TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    inspection_date TEXT NOT NULL,
    status TEXT NOT NULL,
    damage_report TEXT,
    estimated_cost REAL,
    operator TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS deductions (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    inspection_id TEXT,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by TEXT,
    approved_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (inspection_id) REFERENCES inspections(id)
  );

  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by TEXT,
    approved_at TEXT,
    reject_reason TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE TABLE IF NOT EXISTS renewals (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    renewal_date TEXT NOT NULL,
    additional_days INTEGER NOT NULL,
    additional_rent REAL NOT NULL,
    new_expected_return_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
`);

module.exports = db;
