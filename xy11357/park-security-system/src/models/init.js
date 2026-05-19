const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/park-security.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('已连接到 SQLite 数据库');
});

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`CREATE TABLE IF NOT EXISTS visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    id_card TEXT,
    company TEXT,
    visit_reason TEXT,
    visit_date TEXT NOT NULL,
    visit_time_start TEXT,
    visit_time_end TEXT,
    license_plate TEXT,
    host_name TEXT,
    host_dept TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    import_batch_id TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS license_plates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_id TEXT UNIQUE NOT NULL,
    plate_number TEXT NOT NULL,
    owner_name TEXT,
    owner_phone TEXT,
    valid_start_date TEXT NOT NULL,
    valid_end_date TEXT NOT NULL,
    vehicle_type TEXT,
    visit_reason TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    import_batch_id TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blacklist_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    id_number TEXT NOT NULL,
    name TEXT,
    reason TEXT NOT NULL,
    level TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'active',
    effective_date TEXT,
    expiry_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    import_batch_id TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS gate_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT UNIQUE NOT NULL,
    gate_no TEXT NOT NULL,
    check_type TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT,
    subject_name TEXT,
    plate_number TEXT,
    id_card TEXT,
    check_result TEXT NOT NULL,
    reject_reason TEXT,
    operator TEXT,
    check_time TEXT DEFAULT CURRENT_TIMESTAMP,
    visitor_record_id INTEGER,
    plate_record_id INTEGER,
    blacklist_record_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (visitor_record_id) REFERENCES visitors(id),
    FOREIGN KEY (plate_record_id) REFERENCES license_plates(id),
    FOREIGN KEY (blacklist_record_id) REFERENCES blacklist(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_id TEXT UNIQUE NOT NULL,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    operator TEXT,
    ip_address TEXT,
    request_id TEXT,
    request_data TEXT,
    response_data TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS import_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    file_name TEXT,
    total_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    operator TEXT,
    status TEXT DEFAULT 'completed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS import_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    row_number INTEGER,
    original_data TEXT,
    error_message TEXT NOT NULL,
    suggestion TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES import_records(batch_id)
  )`);

  console.log('数据库表创建完成');
});

db.close((err) => {
  if (err) {
    console.error('关闭数据库失败:', err.message);
  }
  console.log('数据库初始化完成');
});
