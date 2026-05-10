const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'complaint_system.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS order_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    supplier TEXT NOT NULL,
    product_name TEXT NOT NULL,
    order_quantity REAL NOT NULL,
    order_weight REAL NOT NULL,
    unit TEXT NOT NULL,
    arrival_date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS weighing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    batch_no TEXT NOT NULL,
    group_leader TEXT NOT NULL,
    weighing_time TEXT NOT NULL,
    actual_quantity REAL NOT NULL,
    actual_weight REAL NOT NULL,
    difference_quantity REAL NOT NULL,
    difference_weight REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES order_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_no TEXT UNIQUE NOT NULL,
    batch_id INTEGER NOT NULL,
    batch_no TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_phone TEXT NOT NULL,
    complaint_time TEXT NOT NULL,
    complaint_type TEXT NOT NULL,
    complaint_content TEXT NOT NULL,
    expected_quantity REAL,
    expected_weight REAL,
    actual_quantity REAL,
    actual_weight REAL,
    status TEXT DEFAULT 'pending',
    handler TEXT,
    handle_time TEXT,
    handle_result TEXT,
    handle_notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES order_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER UNIQUE NOT NULL,
    batch_no TEXT UNIQUE NOT NULL,
    order_quantity REAL NOT NULL,
    order_weight REAL NOT NULL,
    weighed_quantity REAL DEFAULT 0,
    weighed_weight REAL DEFAULT 0,
    total_complaints INTEGER DEFAULT 0,
    pending_complaints INTEGER DEFAULT 0,
    confirmed_complaints INTEGER DEFAULT 0,
    rejected_complaints INTEGER DEFAULT 0,
    total_difference_quantity REAL DEFAULT 0,
    total_difference_weight REAL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES order_batches(id)
  )`);
});

module.exports = db;