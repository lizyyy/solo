const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'clinic.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS consumable_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    consumable_name TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    production_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expiry_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    alert_level TEXT NOT NULL,
    alert_date DATE NOT NULL,
    days_to_expiry INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES consumable_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS department_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    department_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    usage_date DATE NOT NULL,
    operator TEXT NOT NULL,
    status TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES consumable_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recall_notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    recall_reason TEXT NOT NULL,
    recall_level TEXT NOT NULL,
    initiator TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    blocked_reason TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES consumable_batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS return_acceptances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recall_id INTEGER NOT NULL,
    department_name TEXT NOT NULL,
    expected_quantity INTEGER NOT NULL,
    returned_quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    accepted_by TEXT,
    accepted_at DATETIME,
    modified_by TEXT,
    modified_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recall_id) REFERENCES recall_notices(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS risk_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recall_id INTEGER NOT NULL,
    department_name TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    affected_patients INTEGER DEFAULT 0,
    usage_quantity INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recall_id) REFERENCES recall_notices(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    operation TEXT NOT NULL,
    operator TEXT NOT NULL,
    record_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS modification_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    modified_by TEXT NOT NULL,
    modified_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
