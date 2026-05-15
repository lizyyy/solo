import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../../quota_service.db');

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS rule_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      description TEXT,
      effective_date TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS offline_contracts (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      contract_no TEXT NOT NULL,
      supplement_page_no TEXT,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS temporary_whitelist (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      applicant TEXT NOT NULL,
      reason TEXT NOT NULL,
      quota_amount INTEGER NOT NULL,
      is_revoked BOOLEAN DEFAULT 0,
      effective_date TIMESTAMP NOT NULL,
      expiry_date TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS quota_batches (
      id TEXT PRIMARY KEY,
      rule_version TEXT NOT NULL,
      department_id TEXT NOT NULL,
      total_quota INTEGER NOT NULL,
      used_quota INTEGER DEFAULT 0,
      status TEXT DEFAULT 'processing',
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_duration INTEGER,
      remark TEXT,
      FOREIGN KEY (rule_version) REFERENCES rule_versions(version),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS allocation_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      department_id TEXT NOT NULL,
      before_quota INTEGER NOT NULL,
      after_quota INTEGER NOT NULL,
      change_amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES quota_batches(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payment_receipts (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      channel_code TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      manual_remark TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      caller_id TEXT,
      FOREIGN KEY (batch_id) REFERENCES quota_batches(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      before_comparison TEXT NOT NULL,
      after_comparison TEXT NOT NULL,
      execution_duration INTEGER NOT NULL,
      next_steps TEXT NOT NULL,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES quota_batches(id)
    )`);
  });
}

export const runQuery = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const runExecute = (sql: string, params: any[] = []): Promise<sqlite3.RunResult> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};
