const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/hospital.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS beds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_no TEXT NOT NULL UNIQUE,
    ward TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    patient_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    gender TEXT,
    age INTEGER,
    diagnosis TEXT,
    from_department TEXT,
    to_department TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS patient_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id TEXT NOT NULL UNIQUE,
    patient_id TEXT NOT NULL,
    from_department TEXT,
    to_department TEXT,
    from_bed TEXT,
    to_bed TEXT,
    transfer_type TEXT,
    transfer_time DATETIME,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cleaning_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL UNIQUE,
    bed_no TEXT NOT NULL,
    ward TEXT NOT NULL,
    assigned_to TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    timeout_hours INTEGER DEFAULT 2,
    is_timeout INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT NOT NULL UNIQUE,
    batch_type TEXT NOT NULL,
    total_count INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tracking_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_no TEXT NOT NULL UNIQUE,
    batch_id INTEGER,
    bed_no TEXT,
    patient_id TEXT,
    order_id TEXT,
    transfer_id TEXT,
    ward TEXT,
    department TEXT,
    record_type TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    handler TEXT NOT NULL,
    handled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER,
    operation TEXT NOT NULL,
    before_status TEXT,
    after_status TEXT,
    reason TEXT,
    operator TEXT NOT NULL,
    operated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT,
    FOREIGN KEY (record_id) REFERENCES tracking_records(id)
  )`);

  console.log('数据库初始化完成！');
});

db.close();
