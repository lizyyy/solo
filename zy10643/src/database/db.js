const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/reimbursement.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reimbursement_orders (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    budget_subject_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_amount DECIMAL(10,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS budget_subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    total_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
    used_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS budget_transfers (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    reimbursement_order_id TEXT NOT NULL,
    original_subject_id TEXT NOT NULL,
    target_subject_id TEXT NOT NULL,
    transfer_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    flow_type TEXT NOT NULL,
    review_comment TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (reimbursement_order_id) REFERENCES reimbursement_orders(id),
    FOREIGN KEY (original_subject_id) REFERENCES budget_subjects(id),
    FOREIGN KEY (target_subject_id) REFERENCES budget_subjects(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transfer_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    action_by TEXT,
    action_comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transfer_id) REFERENCES budget_transfers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS import_records (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    total_rows INTEGER DEFAULT 0,
    success_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    error_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
