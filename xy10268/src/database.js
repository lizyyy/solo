const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'herbal.db');
const fs = require('fs');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      patient_name TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      medicines TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT NOT NULL UNIQUE,
      prescription_id TEXT NOT NULL,
      status TEXT DEFAULT 'created',
      operator TEXT,
      start_time DATETIME,
      end_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      package_code TEXT NOT NULL UNIQUE,
      batch_id TEXT,
      prescription_id TEXT,
      status TEXT DEFAULT 'created',
      verifier TEXT,
      verify_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      before_data TEXT,
      after_data TEXT,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_history_record ON history(record_type, record_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_batches_prescription ON batches(prescription_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_packages_batch ON packages(batch_id)`);
});

module.exports = db;
