const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/firmware.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        device_model TEXT NOT NULL,
        firmware_version TEXT NOT NULL,
        gray_batch TEXT NOT NULL,
        fault_samples TEXT NOT NULL,
        device_group TEXT NOT NULL,
        status TEXT NOT NULL,
        request_type TEXT NOT NULL,
        reason TEXT,
        applicant TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS approval_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        approval_id TEXT NOT NULL,
        status TEXT NOT NULL,
        operator TEXT NOT NULL,
        comment TEXT,
        changed_fields TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (approval_id) REFERENCES approvals(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_approval_history_approval_id ON approval_history(approval_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_approvals_device_group ON approvals(device_group)`);
      
      resolve();
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  initDatabase,
  runQuery,
  getQuery,
  allQuery
};
