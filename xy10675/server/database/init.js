const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/baby-membership.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    baby_name TEXT,
    baby_birthday TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS baby_birthday_logs (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    old_birthday TEXT,
    new_birthday TEXT,
    operator TEXT NOT NULL,
    status TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (member_id) REFERENCES members(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS benefit_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    min_month INTEGER NOT NULL,
    max_month INTEGER NOT NULL,
    benefits TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS member_benefits (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    status TEXT NOT NULL,
    operator TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (package_id) REFERENCES benefit_packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS benefit_logs (
    id TEXT PRIMARY KEY,
    benefit_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    operator TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (benefit_id) REFERENCES member_benefits(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS experience_appointments (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    experience_type TEXT NOT NULL,
    status TEXT NOT NULL,
    operator TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (member_id) REFERENCES members(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS appointment_logs (
    id TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL,
    old_time TEXT,
    new_time TEXT,
    old_status TEXT,
    new_status TEXT NOT NULL,
    operator TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (appointment_id) REFERENCES experience_appointments(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS return_recycles (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_code TEXT NOT NULL,
    return_type TEXT NOT NULL,
    status TEXT NOT NULL,
    operator TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (member_id) REFERENCES members(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS return_logs (
    id TEXT PRIMARY KEY,
    return_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    operator TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (return_id) REFERENCES return_recycles(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS idempotent_requests (
    id TEXT PRIMARY KEY,
    request_id TEXT UNIQUE NOT NULL,
    api_path TEXT NOT NULL,
    request_data TEXT,
    response_data TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customer_service_notes (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    content TEXT NOT NULL,
    operator TEXT NOT NULL,
    is_public INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (member_id) REFERENCES members(id)
  )`);

  console.log('所有表创建成功');
});

db.close();
