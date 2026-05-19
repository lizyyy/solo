const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/fire-maintenance.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS raw_materials (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    file_name TEXT,
    content TEXT,
    status TEXT DEFAULT 'pending',
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS details (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    building_name TEXT,
    address TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    extinguisher_date DATE,
    sprinkler_date DATE,
    alarm_date DATE,
    category TEXT DEFAULT 'pending',
    category_reason TEXT,
    processor TEXT,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (material_id) REFERENCES raw_materials(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS processing_traces (
    id TEXT PRIMARY KEY,
    detail_id TEXT NOT NULL,
    action TEXT NOT NULL,
    from_category TEXT,
    to_category TEXT,
    reason TEXT,
    operator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (detail_id) REFERENCES details(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS maintenance_tables (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    equipment_type TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
