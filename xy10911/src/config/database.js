const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('已创建 data 目录');
}

const dbPath = path.join(dataDir, 'laundry.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS machines (
    machine_id TEXT PRIMARY KEY,
    location TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS payments (
    payment_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    amount REAL NOT NULL,
    pay_time DATETIME NOT NULL,
    payer_id TEXT,
    pay_channel TEXT,
    status TEXT DEFAULT 'success',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS start_events (
    event_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    payment_id TEXT,
    start_time DATETIME NOT NULL,
    success BOOLEAN DEFAULT 0,
    error_code TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS refund_applications (
    refund_id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL,
    payment_id TEXT NOT NULL,
    start_event_id TEXT,
    fault_code TEXT,
    fault_screenshot TEXT,
    applicant_name TEXT,
    applicant_phone TEXT,
    reason TEXT,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    raw_input TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(machine_id),
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id),
    FOREIGN KEY (start_event_id) REFERENCES start_events(event_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS processing_logs (
    log_id TEXT PRIMARY KEY,
    refund_id TEXT NOT NULL,
    action TEXT NOT NULL,
    operator TEXT,
    conclusion TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (refund_id) REFERENCES refund_applications(refund_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS fault_codes (
    code TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    auto_refund_eligible BOOLEAN DEFAULT 0
  )`);
});

module.exports = db;
