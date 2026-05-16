const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/deletion.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS deletion_requests (
      id TEXT PRIMARY KEY,
      user_subject TEXT NOT NULL,
      deletion_scope TEXT NOT NULL,
      scope_details TEXT,
      grace_period_hours INTEGER NOT NULL DEFAULT 72,
      grace_deadline DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at DATETIME NOT NULL,
      created_by TEXT NOT NULL,
      reason TEXT,
      original_request TEXT NOT NULL,
      processing_evidence TEXT,
      final_conclusion TEXT,
      version INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS revocation_requests (
      id TEXT PRIMARY KEY,
      deletion_request_id TEXT NOT NULL,
      requested_at DATETIME NOT NULL,
      requested_by TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by TEXT,
      reviewed_at DATETIME,
      review_notes TEXT,
      evidence TEXT,
      FOREIGN KEY (deletion_request_id) REFERENCES deletion_requests(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purge_tasks (
      id TEXT PRIMARY KEY,
      deletion_request_id TEXT NOT NULL,
      scheduled_at DATETIME NOT NULL,
      started_at DATETIME,
      completed_at DATETIME,
      status TEXT NOT NULL DEFAULT 'SCHEDULED',
      purge_scope TEXT NOT NULL,
      records_purged INTEGER,
      bytes_purged INTEGER,
      error_details TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      execution_log TEXT,
      evidence_hash TEXT,
      FOREIGN KEY (deletion_request_id) REFERENCES deletion_requests(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS proof_summaries (
      id TEXT PRIMARY KEY,
      deletion_request_id TEXT NOT NULL,
      generated_at DATETIME NOT NULL,
      generated_by TEXT NOT NULL,
      summary_type TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      content TEXT NOT NULL,
      digital_signature TEXT,
      FOREIGN KEY (deletion_request_id) REFERENCES deletion_requests(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      deletion_request_id TEXT NOT NULL,
      old_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      changed_at DATETIME NOT NULL,
      changed_by TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence TEXT,
      FOREIGN KEY (deletion_request_id) REFERENCES deletion_requests(id)
    )
  `);

  console.log('数据库初始化完成');
});

db.close();
