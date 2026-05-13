const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    manager TEXT,
    manager_phone TEXT,
    total_score INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inspection_plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    store_id TEXT NOT NULL,
    store_name TEXT,
    inspector TEXT,
    inspector_phone TEXT,
    plan_date DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    store_name TEXT,
    category TEXT,
    description TEXT NOT NULL,
    photo_url TEXT,
    severity TEXT DEFAULT 'normal',
    points_deducted INTEGER DEFAULT 0,
    deadline DATE,
    status TEXT DEFAULT 'pending',
    rectifier TEXT,
    rectifier_phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inspection_id) REFERENCES inspection_plans(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rectifications (
    id TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL,
    description TEXT,
    photo_url TEXT,
    rectifier TEXT,
    rectifier_phone TEXT,
    completed_at DATETIME,
    status TEXT DEFAULT 'submitted',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (problem_id) REFERENCES problems(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL,
    rectification_id TEXT,
    reviewer TEXT,
    reviewer_phone TEXT,
    result TEXT NOT NULL,
    comment TEXT,
    is_abnormal BOOLEAN DEFAULT 0,
    abnormal_reason TEXT,
    reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (problem_id) REFERENCES problems(id),
    FOREIGN KEY (rectification_id) REFERENCES rectifications(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS penalty_records (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    store_name TEXT,
    problem_id TEXT,
    reason TEXT NOT NULL,
    points_deducted INTEGER NOT NULL,
    is_overdue BOOLEAN DEFAULT 0,
    handler TEXT,
    handled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id),
    FOREIGN KEY (problem_id) REFERENCES problems(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS modification_history (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operator TEXT,
    operation_type TEXT NOT NULL,
    reason TEXT,
    operation_time DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS timeline (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    operator TEXT,
    operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    request_hash TEXT NOT NULL,
    response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  )`);
});

module.exports = db;
