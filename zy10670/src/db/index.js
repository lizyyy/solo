const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dayjs = require('dayjs');

const dbPath = path.join(__dirname, '../../park-energy.db');
const db = new sqlite3.Database(dbPath);

const STATUS = {
  NORMAL: 'normal',
  ABNORMAL_PENDING: 'abnormal_pending',
  CORRECTED: 'corrected',
  CONFIRMED: 'confirmed',
  PENDING_MANUAL: 'pending_manual'
};

const STATUS_LABELS = {
  [STATUS.NORMAL]: '正常',
  [STATUS.ABNORMAL_PENDING]: '异常待查',
  [STATUS.CORRECTED]: '已修正',
  [STATUS.CONFIRMED]: '已确认',
  [STATUS.PENDING_MANUAL]: '待人工处理'
};

function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS meters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meter_no TEXT UNIQUE NOT NULL,
          meter_name TEXT NOT NULL,
          location TEXT,
          type TEXT DEFAULT 'electric',
          is_active INTEGER DEFAULT 1,
          replaced_from INTEGER,
          replace_time TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS meter_readings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meter_id INTEGER NOT NULL,
          reading_value REAL NOT NULL,
          reading_time TEXT NOT NULL,
          collector TEXT,
          import_batch TEXT,
          is_valid INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (meter_id) REFERENCES meters(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS review_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meter_id INTEGER NOT NULL,
          reading_id INTEGER,
          status TEXT NOT NULL DEFAULT 'normal',
          review_note TEXT,
          reviewed_by TEXT,
          anomaly_type TEXT,
          anomaly_detail TEXT,
          previous_reading REAL,
          current_reading REAL,
          previous_reading_time TEXT,
          current_reading_time TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (meter_id) REFERENCES meters(id),
          FOREIGN KEY (reading_id) REFERENCES meter_readings(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS review_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          review_id INTEGER NOT NULL,
          old_status TEXT,
          new_status TEXT NOT NULL,
          change_note TEXT,
          changed_by TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (review_id) REFERENCES review_records(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS import_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_no TEXT UNIQUE NOT NULL,
          file_name TEXT,
          total_count INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          failed_details TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

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

function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDB,
  runQuery,
  getOne,
  getAll,
  STATUS,
  STATUS_LABELS
};
