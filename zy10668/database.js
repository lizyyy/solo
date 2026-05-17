const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'mes_rework.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    work_order_no TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS processes (
    id TEXT PRIMARY KEY,
    process_code TEXT NOT NULL UNIQUE,
    process_name TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rework_reasons (
    id TEXT PRIMARY KEY,
    reason_code TEXT NOT NULL UNIQUE,
    reason_name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS responsibility_teams (
    id TEXT PRIMARY KEY,
    team_code TEXT NOT NULL UNIQUE,
    team_name TEXT NOT NULL,
    leader TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rework_tasks (
    id TEXT PRIMARY KEY,
    rework_no TEXT NOT NULL UNIQUE,
    work_order_id TEXT NOT NULL,
    process_id TEXT NOT NULL,
    rework_reason_id TEXT NOT NULL,
    responsibility_team_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_production',
    remark TEXT,
    manual_remark TEXT,
    is_manual_override INTEGER DEFAULT 0,
    created_by TEXT,
    reviewed_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
    FOREIGN KEY (process_id) REFERENCES processes(id),
    FOREIGN KEY (rework_reason_id) REFERENCES rework_reasons(id),
    FOREIGN KEY (responsibility_team_id) REFERENCES responsibility_teams(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rework_status_history (
    id TEXT PRIMARY KEY,
    rework_task_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    operator TEXT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rework_task_id) REFERENCES rework_tasks(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS import_records (
    id TEXT PRIMARY KEY,
    batch_no TEXT NOT NULL,
    file_name TEXT,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS import_errors (
    id TEXT PRIMARY KEY,
    import_record_id TEXT NOT NULL,
    row_data TEXT,
    error_message TEXT,
    row_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (import_record_id) REFERENCES import_records(id)
  )`);
});

module.exports = db;
