const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'medicine.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS medicine_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_no TEXT UNIQUE NOT NULL,
    vehicle_no TEXT NOT NULL,
    vehicle_name TEXT NOT NULL,
    site_code TEXT NOT NULL,
    site_name TEXT NOT NULL,
    medicine_code TEXT NOT NULL,
    medicine_name TEXT NOT NULL,
    batch_no TEXT NOT NULL,
    manufacture_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    specification TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    vehicle_stock_before INTEGER NOT NULL,
    vehicle_stock_after INTEGER NOT NULL,
    site_stock_before INTEGER NOT NULL,
    site_stock_after INTEGER NOT NULL,
    flow_type TEXT NOT NULL,
    operator TEXT NOT NULL,
    operate_time TEXT NOT NULL,
    status TEXT NOT NULL,
    remark TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS medicine_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    transaction_no TEXT NOT NULL,
    action TEXT NOT NULL,
    operator TEXT NOT NULL,
    operate_time TEXT NOT NULL,
    before_status TEXT,
    after_status TEXT,
    before_quantity INTEGER,
    after_quantity INTEGER,
    before_remark TEXT,
    after_remark TEXT,
    remark TEXT,
    change_content TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (transaction_id) REFERENCES medicine_transactions(id)
  );

  CREATE TABLE IF NOT EXISTS medicine_stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock_type TEXT NOT NULL,
    location_code TEXT NOT NULL,
    location_name TEXT NOT NULL,
    medicine_code TEXT NOT NULL,
    medicine_name TEXT NOT NULL,
    batch_no TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    last_update_time TEXT DEFAULT (datetime('now')),
    UNIQUE(stock_type, location_code, medicine_code, batch_no)
  );

  CREATE INDEX IF NOT EXISTS idx_transaction_no ON medicine_transactions(transaction_no);
  CREATE INDEX IF NOT EXISTS idx_vehicle_no ON medicine_transactions(vehicle_no);
  CREATE INDEX IF NOT EXISTS idx_site_code ON medicine_transactions(site_code);
  CREATE INDEX IF NOT EXISTS idx_status ON medicine_transactions(status);
  CREATE INDEX IF NOT EXISTS idx_history_transaction_id ON medicine_history(transaction_id);
`);

module.exports = db;
