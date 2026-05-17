const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'code_freeze.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS freeze_rules (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    freeze_start DATETIME NOT NULL,
    freeze_end DATETIME NOT NULL,
    allowed_users TEXT,
    allowed_branches TEXT,
    status TEXT DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repo_id) REFERENCES repositories(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exception_requests (
    id TEXT PRIMARY KEY,
    repo_id TEXT NOT NULL,
    rule_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    risk_description TEXT NOT NULL,
    requester TEXT NOT NULL,
    approver TEXT,
    status TEXT DEFAULT 'pending',
    release_window_start DATETIME,
    release_window_end DATETIME,
    commit_hash TEXT,
    branch TEXT,
    original_request TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repo_id) REFERENCES repositories(id),
    FOREIGN KEY (rule_id) REFERENCES freeze_rules(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    operator TEXT NOT NULL,
    reason TEXT NOT NULL,
    original_input TEXT,
    processing_evidence TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES exception_requests(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_conclusions (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    conclusion TEXT NOT NULL,
    auditor TEXT NOT NULL,
    findings TEXT,
    recommendations TEXT,
    verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES exception_requests(id)
  )`);
});

module.exports = db;
