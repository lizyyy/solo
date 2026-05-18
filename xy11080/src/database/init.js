const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/swim_pool.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS water_temp_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_no TEXT UNIQUE NOT NULL,
    pool_name TEXT NOT NULL,
    pool_no TEXT NOT NULL,
    pool_type TEXT NOT NULL,
    record_date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    time_slot_start TEXT NOT NULL,
    time_slot_end TEXT NOT NULL,
    standard_temp_min REAL NOT NULL,
    standard_temp_max REAL NOT NULL,
    actual_temp REAL NOT NULL,
    measure_time TEXT NOT NULL,
    measure_person TEXT NOT NULL,
    is_temp_compliant INTEGER NOT NULL,
    affected_periods TEXT,
    course_id TEXT,
    course_name TEXT,
    coach_name TEXT,
    registered_count INTEGER DEFAULT 0,
    attended_count INTEGER DEFAULT 0,
    need_compensation INTEGER DEFAULT 0,
    compensation_type TEXT,
    compensation_amount REAL DEFAULT 0,
    compensation_quantity INTEGER DEFAULT 0,
    compensation_table_version TEXT,
    is_compensation_consistent INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    manual_remark TEXT,
    reviewer TEXT,
    review_time TEXT,
    import_batch_no TEXT,
    import_time TEXT,
    import_operator TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bad_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_batch_no TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    original_data TEXT NOT NULL,
    error_reason TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    import_time TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS status_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    operator TEXT NOT NULL,
    remark TEXT,
    operation_time TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS import_batches (
    batch_no TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    import_operator TEXT,
    import_time TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS historical_records_v1 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    old_system_id TEXT,
    pool_name TEXT,
    record_date TEXT,
    water_temp REAL,
    status TEXT,
    remark TEXT,
    migrated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('数据库初始化完成');
});

module.exports = db;