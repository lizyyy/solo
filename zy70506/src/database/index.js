const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/compensation.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_records (
      id TEXT PRIMARY KEY,
      approval_no TEXT NOT NULL,
      business_order_no TEXT NOT NULL,
      callback_event TEXT NOT NULL,
      compensation_action TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      max_retry INTEGER DEFAULT 3,
      status TEXT NOT NULL,
      raw_input TEXT,
      processing_evidence TEXT,
      final_conclusion TEXT,
      error_message TEXT,
      created_by TEXT,
      handled_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(approval_no, callback_event)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensation_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES compensation_records(id)
    )
  `);
});

const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const getAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync
};