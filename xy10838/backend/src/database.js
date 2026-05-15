const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../data/database.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS data_domains (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        retention_days INTEGER NOT NULL DEFAULT 365,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS retention_rules (
        id TEXT PRIMARY KEY,
        domain_id TEXT NOT NULL,
        name TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        conditions TEXT,
        priority INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (domain_id) REFERENCES data_domains(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS deletion_requests (
        id TEXT PRIMARY KEY,
        request_no TEXT UNIQUE NOT NULL,
        customer_id TEXT NOT NULL,
        customer_name TEXT,
        reason TEXT,
        requested_by TEXT NOT NULL,
        status TEXT DEFAULT 'DRAFT',
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_by TEXT,
        approved_at DATETIME,
        executed_by TEXT,
        executed_at DATETIME,
        completed_at DATETIME,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS execution_tasks (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        domain_id TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        total_records INTEGER DEFAULT 0,
        processed_records INTEGER DEFAULT 0,
        failed_records INTEGER DEFAULT 0,
        started_at DATETIME,
        completed_at DATETIME,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES deletion_requests(id),
        FOREIGN KEY (domain_id) REFERENCES data_domains(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS failed_items (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        record_type TEXT,
        error_code TEXT,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'FAILED',
        failed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (task_id) REFERENCES execution_tasks(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS customer_receipts (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL UNIQUE,
        receipt_no TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'GENERATING',
        content TEXT,
        generated_at DATETIME,
        sent_at DATETIME,
        confirmed_by TEXT,
        confirmed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES deletion_requests(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        task_id TEXT,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        before_state TEXT,
        after_state TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      resolve();
    });
  });
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  initDatabase,
  runQuery,
  getQuery,
  allQuery,
  uuid: uuidv4
};
