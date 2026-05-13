const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'volunteer.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS volunteer_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL,
    volunteer_name TEXT NOT NULL,
    skill_type TEXT NOT NULL,
    skill_level TEXT DEFAULT '初级',
    status TEXT DEFAULT '待审核',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS shift_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL,
    volunteer_name TEXT NOT NULL,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    shift_type TEXT,
    location TEXT,
    status TEXT DEFAULT '已排班',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL,
    volunteer_name TEXT NOT NULL,
    shift_id INTEGER,
    check_in_time DATETIME,
    check_out_time DATETIME,
    check_in_location TEXT,
    check_out_location TEXT,
    status TEXT DEFAULT '待签到',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS material_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL,
    volunteer_name TEXT NOT NULL,
    package_type TEXT NOT NULL,
    items TEXT,
    distributed BOOLEAN DEFAULT 0,
    distributed_at DATETIME,
    distributed_by TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subsidy_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    conditions TEXT,
    effective_date DATE,
    expiry_date DATE,
    status TEXT DEFAULT '生效中',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS subsidy_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL,
    volunteer_name TEXT NOT NULL,
    rule_id INTEGER,
    rule_name TEXT,
    amount DECIMAL(10,2) NOT NULL,
    shift_id INTEGER,
    attendance_id INTEGER,
    callback_id TEXT UNIQUE,
    status TEXT DEFAULT '待发放',
    remarks TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exception_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL,
    volunteer_name TEXT NOT NULL,
    exception_type TEXT NOT NULL,
    description TEXT,
    related_id INTEGER,
    related_type TEXT,
    status TEXT DEFAULT '待处理',
    handled_by TEXT,
    handled_at DATETIME,
    handler_remark TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT,
    updated_at DATETIME
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    operation TEXT NOT NULL,
    operator TEXT NOT NULL,
    operate_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    volunteer_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    operator TEXT,
    operate_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT,
    related_id INTEGER,
    related_type TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    id_card TEXT,
    email TEXT,
    status TEXT DEFAULT '正常',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
