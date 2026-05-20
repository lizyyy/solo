const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'stability-test.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        batch_no TEXT UNIQUE NOT NULL,
        product_name TEXT NOT NULL,
        specification TEXT,
        manufacturer TEXT,
        production_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        remark TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS raw_materials (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        material_hash TEXT NOT NULL,
        material_content TEXT NOT NULL,
        file_name TEXT,
        uploaded_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )`);

      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_material_hash ON raw_materials(material_hash)`);

      db.run(`CREATE TABLE IF NOT EXISTS test_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        material_id TEXT NOT NULL,
        sample_no TEXT NOT NULL,
        chamber_id TEXT NOT NULL,
        condition_code TEXT NOT NULL,
        temperature REAL NOT NULL,
        humidity REAL,
        sampling_month INTEGER NOT NULL,
        sampling_date TEXT,
        planned_test_date TEXT,
        actual_test_date TEXT,
        status TEXT DEFAULT 'pending',
        is_affected_by_overtemp INTEGER DEFAULT 0,
        overtemp_start TEXT,
        overtemp_end TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (material_id) REFERENCES raw_materials(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS processing_traces (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        action TEXT NOT NULL,
        action_time TEXT DEFAULT CURRENT_TIMESTAMP,
        operator TEXT,
        remark TEXT,
        original_position TEXT,
        FOREIGN KEY (record_id) REFERENCES test_records(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS errors (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        material_id TEXT,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        original_position TEXT,
        field_name TEXT,
        raw_value TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        resolved INTEGER DEFAULT 0
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS chamber_events (
        id TEXT PRIMARY KEY,
        chamber_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        temperature REAL,
        humidity REAL,
        remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

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
  allQuery,
  db
};
