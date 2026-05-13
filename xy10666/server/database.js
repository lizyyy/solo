const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'mold_management.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS molds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mold_code TEXT UNIQUE NOT NULL,
    mold_name TEXT NOT NULL,
    mold_type TEXT,
    max_strokes INTEGER DEFAULT 1000000,
    current_strokes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'normal',
    location TEXT,
    responsible_person TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS maintenance_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mold_id INTEGER NOT NULL,
    plan_type TEXT NOT NULL,
    interval_strokes INTEGER NOT NULL,
    next_maintenance_stroke INTEGER NOT NULL,
    last_maintenance_stroke INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mold_id) REFERENCES molds(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mold_id INTEGER NOT NULL,
    maintenance_type TEXT NOT NULL,
    start_stroke INTEGER,
    end_stroke INTEGER,
    description TEXT,
    responsible_person TEXT,
    maintenance_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mold_id) REFERENCES molds(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS production_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mold_id INTEGER NOT NULL,
    task_code TEXT UNIQUE NOT NULL,
    product_name TEXT,
    planned_quantity INTEGER,
    start_stroke INTEGER,
    end_stroke INTEGER,
    status TEXT DEFAULT 'pending',
    operator TEXT,
    scheduled_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mold_id) REFERENCES molds(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS change_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS flow_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flow_type TEXT NOT NULL,
    mold_id INTEGER,
    related_id INTEGER,
    related_type TEXT,
    action TEXT NOT NULL,
    operator TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mold_id INTEGER NOT NULL,
    exception_type TEXT NOT NULL,
    severity TEXT DEFAULT 'warning',
    description TEXT,
    status TEXT DEFAULT 'open',
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by TEXT,
    FOREIGN KEY (mold_id) REFERENCES molds(id)
  )`);
});

module.exports = db;
