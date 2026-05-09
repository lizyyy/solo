const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'referral.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    id_card TEXT,
    gender TEXT,
    age INTEGER,
    phone TEXT,
    address TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS referral_orders (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    referral_no TEXT UNIQUE,
    source_hospital TEXT,
    source_department TEXT,
    source_doctor TEXT,
    target_hospital TEXT,
    target_department TEXT,
    target_doctor TEXT,
    referral_reason TEXT,
    initial_diagnosis TEXT,
    status TEXT DEFAULT 'pending',
    referral_time DATETIME,
    visit_time DATETIME,
    check_time DATETIME,
    report_time DATETIME,
    close_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    referral_order_id TEXT NOT NULL,
    appointment_time DATETIME,
    check_type TEXT,
    check_item TEXT,
    dept_name TEXT,
    bed_no TEXT,
    status TEXT DEFAULT 'scheduled',
    check_result TEXT,
    report_url TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referral_order_id) REFERENCES referral_orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exam_results (
    id TEXT PRIMARY KEY,
    referral_order_id TEXT NOT NULL,
    exam_type TEXT,
    exam_name TEXT,
    exam_time DATETIME,
    exam_doctor TEXT,
    exam_result TEXT,
    report_file TEXT,
    abnormal_flag INTEGER DEFAULT 0,
    abnormal_desc TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referral_order_id) REFERENCES referral_orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exceptions (
    id TEXT PRIMARY KEY,
    referral_order_id TEXT,
    exception_type TEXT,
    exception_level TEXT,
    exception_content TEXT,
    handled INTEGER DEFAULT 0,
    handle_time DATETIME,
    handle_user TEXT,
    handle_result TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referral_order_id) REFERENCES referral_orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    referral_order_id TEXT,
    operation_type TEXT,
    operation_content TEXT,
    operator TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referral_order_id) REFERENCES referral_orders(id)
  )`);
});

module.exports = db;
