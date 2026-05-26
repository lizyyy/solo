const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cash.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        store_id TEXT NOT NULL,
        store_name TEXT NOT NULL,
        region TEXT NOT NULL,
        submit_date TEXT NOT NULL,
        processor TEXT NOT NULL,
        remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS daily_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        record_date TEXT NOT NULL,
        store_id TEXT NOT NULL,
        pos_sales REAL DEFAULT 0,
        cash_deposit REAL DEFAULT 0,
        imprest_borrow REAL DEFAULT 0,
        imprest_return REAL DEFAULT 0,
        opening_cash REAL DEFAULT 0,
        closing_cash REAL DEFAULT 0,
        is_holiday INTEGER DEFAULT 0,
        holiday_delay_note TEXT,
        category TEXT NOT NULL,
        category_reason TEXT NOT NULL,
        next_action TEXT NOT NULL,
        cash_short_long REAL DEFAULT 0,
        theoretical_cash REAL DEFAULT 0,
        is_balanced INTEGER DEFAULT 0,
        processor TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_batch_no ON batches(batch_no)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_record_date ON daily_records(record_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_category ON daily_records(category)`);
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function serialize(callback) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      callback().then(resolve).catch(reject);
    });
  });
}

module.exports = {
  db,
  run,
  get,
  all,
  serialize
};
