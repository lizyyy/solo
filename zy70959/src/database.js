const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'maintenance.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_hash TEXT UNIQUE NOT NULL,
          batch_name TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT NOT NULL DEFAULT 'processing',
          raw_data TEXT NOT NULL,
          error_message TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS maintenance_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id INTEGER NOT NULL,
          dormitory TEXT NOT NULL,
          room_number TEXT NOT NULL,
          student_id TEXT NOT NULL,
          student_name TEXT NOT NULL,
          repair_type TEXT NOT NULL,
          repair_date DATE NOT NULL,
          initial_score INTEGER,
          initial_comment TEXT,
          appeal_score INTEGER,
          appeal_reason TEXT,
          review_score INTEGER,
          review_reason TEXT,
          is_malicious_low_score INTEGER DEFAULT 0,
          malicious_reason TEXT,
          final_score INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (batch_id) REFERENCES batches(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_id INTEGER NOT NULL,
          batch_id INTEGER NOT NULL,
          modified_by TEXT NOT NULL,
          modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          field_name TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          change_reason TEXT NOT NULL,
          FOREIGN KEY (record_id) REFERENCES maintenance_records(id),
          FOREIGN KEY (batch_id) REFERENCES batches(id)
        )
      `);

      db.run('CREATE INDEX IF NOT EXISTS idx_batches_hash ON batches(batch_hash)');
      db.run('CREATE INDEX IF NOT EXISTS idx_records_batch ON maintenance_records(batch_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id)', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
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

module.exports = {
  db,
  initDatabase,
  run,
  get,
  all
};
