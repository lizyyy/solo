const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'laundry.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS room_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_type TEXT NOT NULL UNIQUE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit TEXT DEFAULT '件',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS laundry_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT NOT NULL UNIQUE,
    send_date DATE NOT NULL,
    total_items INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS laundry_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    room_type TEXT,
    item_name TEXT,
    send_quantity INTEGER,
    recovery_quantity INTEGER DEFAULT 0,
    FOREIGN KEY (batch_id) REFERENCES laundry_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recovery_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    recovery_no TEXT,
    recovery_date DATE,
    handler TEXT,
    status TEXT DEFAULT 'pending',
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES laundry_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recovery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recovery_id INTEGER,
    laundry_item_id INTEGER,
    room_type TEXT,
    item_name TEXT,
    quantity INTEGER,
    FOREIGN KEY (recovery_id) REFERENCES recovery_records(id),
    FOREIGN KEY (laundry_item_id) REFERENCES laundry_items(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS compensation_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER,
    item_name TEXT,
    room_type TEXT,
    shortage_qty INTEGER DEFAULT 0,
    damage_qty INTEGER DEFAULT 0,
    duplicate_qty INTEGER DEFAULT 0,
    reason TEXT NOT NULL,
    handler TEXT NOT NULL,
    handle_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending',
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES laundry_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL,
    record_type TEXT,
    record_id INTEGER,
    operator TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    before_status TEXT,
    after_status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
