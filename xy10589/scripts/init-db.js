const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'audit.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_issues (
      id TEXT PRIMARY KEY,
      audit_id TEXT NOT NULL,
      issue_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      responsible_department TEXT NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT NOT NULL,
      original_due_date TEXT NOT NULL,
      customer_approved INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      idempotency_key TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rectification_plans (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      plan_content TEXT NOT NULL,
      responsible_person TEXT NOT NULL,
      target_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (issue_id) REFERENCES audit_issues(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS evidences (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      file_url TEXT,
      submitted_by TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      is_valid INTEGER DEFAULT 1,
      FOREIGN KEY (issue_id) REFERENCES audit_issues(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      review_type TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      result TEXT NOT NULL,
      comments TEXT,
      reviewed_at TEXT NOT NULL,
      FOREIGN KEY (issue_id) REFERENCES audit_issues(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (issue_id) REFERENCES audit_issues(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS correction_records (
      id TEXT PRIMARY KEY,
      issue_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      corrected_by TEXT NOT NULL,
      reason TEXT NOT NULL,
      corrected_at TEXT NOT NULL,
      FOREIGN KEY (issue_id) REFERENCES audit_issues(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS idempotency_log (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      issue_id TEXT NOT NULL,
      action TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_audit_issues_status ON audit_issues(status)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_audit_issues_department ON audit_issues(responsible_department)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_status_history_issue ON status_history(issue_id)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_evidences_issue ON evidences(issue_id)
  `);

  console.log('数据库表创建成功');
});

db.close();
