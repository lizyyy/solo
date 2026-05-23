const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "../../data/inspection.db");
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        sender TEXT,
        receive_date TEXT,
        status TEXT DEFAULT "pending",
        remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_no TEXT UNIQUE NOT NULL,
        batch_id INTEGER,
        sample_name TEXT,
        sample_type TEXT,
        quantity REAL,
        unit TEXT,
        package TEXT,
        status TEXT DEFAULT "pending",
        recheck_count INTEGER DEFAULT 0,
        recheck_result TEXT,
        remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS test_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_code TEXT UNIQUE NOT NULL,
        item_name TEXT NOT NULL,
        item_package TEXT,
        standard TEXT,
        method TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER,
        sample_id INTEGER,
        operation_type TEXT NOT NULL,
        reason TEXT,
        handler TEXT NOT NULL,
        operation_time TEXT DEFAULT CURRENT_TIMESTAMP,
        old_status TEXT,
        new_status TEXT,
        detail TEXT,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (sample_id) REFERENCES samples(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_sample_no ON samples(sample_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batch_id ON samples(batch_id)`);

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

module.exports = { db, initDatabase, runQuery, getQuery, allQuery };
