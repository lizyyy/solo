const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'prescriptions.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      prescription_no TEXT UNIQUE NOT NULL,
      order_id TEXT,
      patient_name TEXT,
      patient_id_card TEXT,
      doctor_name TEXT,
      hospital_name TEXT,
      issue_date DATETIME NOT NULL,
      expire_date DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS prescription_medicines (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      specification TEXT,
      dosage TEXT,
      quantity INTEGER NOT NULL,
      unit TEXT,
      price REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pharmacist_reviews (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      pharmacist_id TEXT NOT NULL,
      pharmacist_name TEXT NOT NULL,
      review_result TEXT NOT NULL,
      review_comment TEXT,
      review_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS return_records (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      return_reason TEXT NOT NULL,
      return_detail TEXT,
      operator_id TEXT,
      operator_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS medicine_exchange (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      original_medicine_id TEXT,
      original_medicine_name TEXT,
      new_medicine_name TEXT NOT NULL,
      new_specification TEXT,
      new_dosage TEXT,
      new_quantity INTEGER,
      exchange_reason TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      operator_id TEXT,
      operator_name TEXT,
      pharmacist_approval_id TEXT,
      pharmacist_approval_name TEXT,
      approval_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exception_records (
      id TEXT PRIMARY KEY,
      prescription_id TEXT,
      request_id TEXT UNIQUE,
      api_path TEXT,
      original_input TEXT,
      error_type TEXT,
      error_message TEXT,
      processing_result TEXT,
      handled INTEGER DEFAULT 0,
      handled_by TEXT,
      handled_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      prescription_id TEXT,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      operator_id TEXT,
      operator_name TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表创建完成');
});

db.close();
