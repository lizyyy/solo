const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'prescription_system.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS consultation_records (
        id TEXT PRIMARY KEY,
        patient_name TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        doctor_name TEXT NOT NULL,
        doctor_id TEXT NOT NULL,
        department TEXT,
        symptoms TEXT,
        diagnosis TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS prescription_versions (
        id TEXT PRIMARY KEY,
        consultation_id TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        medicines TEXT NOT NULL,
        dosage TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (consultation_id) REFERENCES consultation_records(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS pharmacist_reviews (
        id TEXT PRIMARY KEY,
        prescription_id TEXT NOT NULL,
        pharmacist_name TEXT NOT NULL,
        pharmacist_id TEXT NOT NULL,
        review_result TEXT NOT NULL,
        review_notes TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prescription_id) REFERENCES prescription_versions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS payment_orders (
        id TEXT PRIMARY KEY,
        consultation_id TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        transaction_id TEXT,
        paid_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (consultation_id) REFERENCES consultation_records(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inventory_replacements (
        id TEXT PRIMARY KEY,
        prescription_id TEXT NOT NULL,
        original_medicine TEXT NOT NULL,
        replacement_medicine TEXT NOT NULL,
        reason TEXT,
        approved_by TEXT,
        approved_at DATETIME,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prescription_id) REFERENCES prescription_versions(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS delivery_status (
        id TEXT PRIMARY KEY,
        consultation_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        courier TEXT,
        tracking_number TEXT,
        estimated_delivery DATETIME,
        delivered_at DATETIME,
        idempotency_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (consultation_id) REFERENCES consultation_records(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        consultation_id TEXT,
        operator TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS change_history (
        id TEXT PRIMARY KEY,
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by TEXT NOT NULL,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      resolve();
    });
  });
}

module.exports = { db, initDatabase };
