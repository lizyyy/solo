const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'waitlist.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    content_hash TEXT UNIQUE NOT NULL,
    submitter TEXT NOT NULL,
    submit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    community TEXT NOT NULL,
    total_applications INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processed'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    applicant_name TEXT NOT NULL,
    id_card TEXT NOT NULL,
    phone TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    relationship TEXT,
    status TEXT DEFAULT 'pending',
    register_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    cancel_time DATETIME,
    last_handler TEXT,
    last_handle_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    remark TEXT,
    FOREIGN KEY (submission_id) REFERENCES submissions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    operator TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    old_remark TEXT,
    new_remark TEXT,
    reason TEXT NOT NULL,
    operate_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_hash ON submissions(content_hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_applications_submission ON applications(submission_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_applications ON audit_logs(application_id)`);
});

function generateContentHash(data) {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

module.exports = { db, generateContentHash };
