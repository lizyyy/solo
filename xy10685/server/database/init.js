const db = require('./db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS freezers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    current_temperature REAL,
    min_temperature REAL DEFAULT -25,
    max_temperature REAL DEFAULT -15,
    status TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS vaccines (
    id TEXT PRIMARY KEY,
    batch_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    manufacturer TEXT,
    production_date DATE,
    expiry_date DATE,
    total_count INTEGER DEFAULT 0,
    available_count INTEGER DEFAULT 0,
    freezer_id TEXT,
    status TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (freezer_id) REFERENCES freezers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    vaccine_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    appointment_date DATETIME NOT NULL,
    quantity INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    operator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vaccine_id) REFERENCES vaccines(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory_records (
    id TEXT PRIMARY KEY,
    freezer_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expected_count INTEGER NOT NULL,
    actual_count INTEGER NOT NULL,
    difference INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    operator TEXT NOT NULL,
    reviewer TEXT,
    review_time DATETIME,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (freezer_id) REFERENCES freezers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS damage_reports (
    id TEXT PRIMARY KEY,
    batch_number TEXT NOT NULL,
    vaccine_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reporter TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    approver TEXT,
    approval_time DATETIME,
    approval_remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_history (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    record_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operator TEXT NOT NULL,
    operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
    id TEXT PRIMARY KEY,
    request_hash TEXT NOT NULL UNIQUE,
    response_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('数据库表创建完成');
});

db.close();
