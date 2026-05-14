import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || './audit_log.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS duty_records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      engineer_id TEXT NOT NULL,
      engineer_name TEXT NOT NULL,
      shift_type TEXT NOT NULL,
      status TEXT NOT NULL,
      risk_type TEXT,
      anomaly_type TEXT,
      anomaly_description TEXT,
      merge_error BOOLEAN DEFAULT 0,
      merged_with TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived BOOLEAN DEFAULT 0,
      archive_batch_id TEXT,
      is_dirty BOOLEAN DEFAULT 0,
      remarks TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS archive_batches (
      id TEXT PRIMARY KEY,
      batch_no TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      total_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      archive_path TEXT,
      created_at TEXT NOT NULL,
      executed_at TEXT,
      completed_at TEXT,
      request_id TEXT,
      remarks TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS archive_details (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      record_id TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES archive_batches(id),
      FOREIGN KEY (record_id) REFERENCES duty_records(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      operation_type TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      record_id TEXT,
      old_value TEXT,
      new_value TEXT,
      remarks TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES archive_batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS export_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      export_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      review_status TEXT DEFAULT 'pending',
      reviewer_id TEXT,
      reviewer_name TEXT,
      review_remarks TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      FOREIGN KEY (batch_id) REFERENCES archive_batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS erase_requests (
      id TEXT PRIMARY KEY,
      request_no TEXT NOT NULL UNIQUE,
      requester_id TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      record_ids TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      executed_at TEXT,
      created_at TEXT NOT NULL,
      remarks TEXT
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_duty_date ON duty_records(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_duty_status ON duty_records(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_duty_archived ON duty_records(archived)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_batch_status ON archive_batches(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_batch_operator ON archive_batches(operator_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_details_batch ON archive_details(batch_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_logs_batch ON operation_logs(batch_id)`);
  });
}

export function runQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function getQuery(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allQuery(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}