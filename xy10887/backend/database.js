const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'consent.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    applicable_scope TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_by TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    template_version TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    signature_data TEXT NOT NULL,
    signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    withdrawn_at DATETIME,
    withdrawn_reason TEXT,
    FOREIGN KEY (template_id) REFERENCES templates(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS resign_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    old_template_id INTEGER NOT NULL,
    old_template_version TEXT NOT NULL,
    new_template_id INTEGER NOT NULL,
    new_template_version TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_signatures_patient ON signatures(patient_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_signatures_template ON signatures(template_version)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resign_patient ON resign_tasks(patient_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resign_status ON resign_tasks(status)`);
});

module.exports = db;