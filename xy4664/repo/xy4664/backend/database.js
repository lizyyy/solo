const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'interview-audit.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      position TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS interview_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      feedback_id TEXT NOT NULL,
      round_name TEXT,
      interviewer_name TEXT,
      interview_date DATE,
      overall_rating REAL,
      technical_rating REAL,
      soft_skill_rating REAL,
      feedback_text TEXT,
      status TEXT,
      version INTEGER DEFAULT 1,
      version_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id),
      UNIQUE(candidate_id, feedback_id, version)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      action TEXT NOT NULL,
      action_type TEXT,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      operator TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS offer_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      approval_id TEXT,
      approver TEXT,
      approval_date DATE,
      approval_status TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS report_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      final_status TEXT,
      final_rating REAL,
      report_content TEXT,
      snapshot_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS review_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id TEXT NOT NULL,
      issue_id TEXT NOT NULL,
      comment TEXT NOT NULL,
      reviewer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_candidates_candidate_id ON candidates(candidate_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_interview_feedback_candidate_id ON interview_feedback(candidate_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_candidate_id ON audit_logs(candidate_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_offer_approvals_candidate_id ON offer_approvals(candidate_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_report_snapshots_candidate_id ON report_snapshots(candidate_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_review_comments_candidate_id ON review_comments(candidate_id)`);
});

module.exports = db;
