const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'contract-signature.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      contract_no TEXT NOT NULL UNIQUE,
      contract_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS signatories (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      signatory_name TEXT NOT NULL,
      signatory_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS signature_records (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      signatory_id TEXT NOT NULL,
      signature_no TEXT,
      resign_reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending_sign',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id),
      FOREIGN KEY (signatory_id) REFERENCES signatories(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS signature_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      signatory_id TEXT NOT NULL,
      signature_no TEXT,
      resign_reason TEXT,
      status TEXT NOT NULL,
      version INTEGER NOT NULL,
      operation TEXT NOT NULL,
      operator TEXT,
      operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      remarks TEXT,
      FOREIGN KEY (record_id) REFERENCES signature_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pending_manual_process (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      conflict_description TEXT NOT NULL,
      download_version INTEGER,
      current_version INTEGER,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES signature_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS import_records (
      id TEXT PRIMARY KEY,
      batch_no TEXT NOT NULL,
      row_data TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

module.exports = db;
