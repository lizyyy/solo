const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/license.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        credit_code TEXT UNIQUE,
        registered_address TEXT,
        legal_representative TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS license_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE,
        description TEXT,
        validity_period INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS licenses (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        license_type_id TEXT NOT NULL,
        license_number TEXT,
        issue_date DATE,
        expiry_date DATE,
        annual_check_deadline DATE,
        responsible_person TEXT,
        responsible_phone TEXT,
        status TEXT DEFAULT 'pending',
        risk_level TEXT DEFAULT 'low',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id),
        FOREIGN KEY (license_type_id) REFERENCES license_types(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        license_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        uploader TEXT,
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at DATETIME,
        review_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (license_id) REFERENCES licenses(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id TEXT PRIMARY KEY,
        license_id TEXT,
        operation_type TEXT NOT NULL,
        operation_status TEXT NOT NULL,
        operator TEXT,
        details TEXT,
        failure_reason TEXT,
        request_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (license_id) REFERENCES licenses(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_licenses_company ON licenses(company_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_licenses_deadline ON licenses(annual_check_deadline)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_logs_license ON operation_logs(license_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_logs_request ON operation_logs(request_id)`);

      resolve();
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function runExecute(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = { db, initDatabase, runQuery, runExecute };
