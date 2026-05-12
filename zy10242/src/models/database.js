const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/claim.db');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS claims (
      claim_id TEXT PRIMARY KEY,
      policy_number TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      accident_type TEXT NOT NULL,
      accident_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deadline TEXT,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      material_id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      material_code TEXT NOT NULL,
      material_name TEXT NOT NULL,
      description TEXT,
      is_required INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      version INTEGER NOT NULL DEFAULT 1,
      file_path TEXT,
      file_name TEXT,
      file_size INTEGER,
      uploaded_at TEXT,
      uploaded_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (claim_id) REFERENCES claims(claim_id),
      UNIQUE(claim_id, material_code, version)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      material_id TEXT,
      action TEXT NOT NULL,
      action_type TEXT NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      old_status TEXT,
      new_status TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (claim_id) REFERENCES claims(claim_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reminders (
      reminder_id TEXT PRIMARY KEY,
      claim_id TEXT NOT NULL,
      material_id TEXT,
      reminder_type TEXT NOT NULL,
      reminder_reason TEXT NOT NULL,
      reminder_count INTEGER NOT NULL DEFAULT 1,
      last_reminded_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (claim_id) REFERENCES claims(claim_id),
      UNIQUE(claim_id, material_id, reminder_type, reminder_reason)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS material_templates (
      template_id TEXT PRIMARY KEY,
      accident_type TEXT NOT NULL,
      material_code TEXT NOT NULL,
      material_name TEXT NOT NULL,
      description TEXT,
      is_required INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(accident_type, material_code)
    )
  `);
});

module.exports = db;
