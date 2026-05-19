const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/critical_values.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    import_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    import_by TEXT NOT NULL,
    shift_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS critical_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    ward TEXT,
    bed_no TEXT,
    test_item TEXT NOT NULL,
    test_result TEXT NOT NULL,
    reference_range TEXT,
    critical_level TEXT NOT NULL,
    report_time DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    has_multiple_records INTEGER DEFAULT 0,
    timeout_flag INTEGER DEFAULT 0,
    handover_gap INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS callbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    critical_value_id INTEGER NOT NULL,
    call_time DATETIME,
    caller TEXT,
    receiver TEXT,
    receiver_role TEXT,
    callback_content TEXT,
    callback_status TEXT,
    confirm_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (critical_value_id) REFERENCES critical_values(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS duty_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    duty_date DATE NOT NULL,
    shift_type TEXT NOT NULL,
    doctor_name TEXT,
    nurse_name TEXT,
    director_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(duty_date, shift_type)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS processing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    critical_value_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    operator TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    reason TEXT,
    previous_status TEXT,
    new_status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (critical_value_id) REFERENCES critical_values(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    operator TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('数据库初始化完成');
});

db.close();
