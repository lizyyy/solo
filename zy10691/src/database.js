const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS vulnerability_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
        version TEXT DEFAULT '1.0',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS scan_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repository_id INTEGER NOT NULL,
        rule_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        line_number INTEGER,
        commit_hash TEXT,
        status TEXT CHECK(status IN ('OPEN', 'REVIEWING', 'FALSE_POSITIVE', 'FIXED')) DEFAULT 'OPEN',
        scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (repository_id) REFERENCES repositories(id),
        FOREIGN KEY (rule_id) REFERENCES vulnerability_rules(rule_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS review_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_result_id INTEGER NOT NULL,
        reviewer TEXT NOT NULL,
        review_type TEXT CHECK(review_type IN ('SUBMIT', 'CLOSE', 'REOPEN')) NOT NULL,
        comment TEXT,
        previous_status TEXT,
        new_status TEXT,
        rule_version_at_review TEXT,
        file_path_at_review TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scan_result_id) REFERENCES scan_results(id)
      )`);

      resolve();
    });
  });
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { db, initDatabase, closeDatabase };
