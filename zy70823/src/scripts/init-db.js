const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/vaccine.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    community_name TEXT NOT NULL,
    submitter TEXT NOT NULL,
    material_fingerprint TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    total_materials INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    child_name TEXT NOT NULL,
    child_id_card TEXT NOT NULL,
    phone TEXT NOT NULL,
    original_appointment_date DATE,
    target_vaccine TEXT,
    reschedule_reason TEXT,
    status TEXT DEFAULT 'pending',
    current_handler TEXT,
    is_out_of_stock INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS process_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id TEXT NOT NULL,
    action TEXT NOT NULL,
    handler TEXT NOT NULL,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS archives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    archive_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_by TEXT NOT NULL,
    total_records INTEGER NOT NULL,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )`);

  console.log('数据库初始化完成');
});

db.close();
