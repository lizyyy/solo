const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const db = new sqlite3.Database('./training.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS course_packages (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      course_type TEXT NOT NULL,
      purchased_hours INTEGER NOT NULL,
      gifted_hours INTEGER DEFAULT 0,
      total_hours INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      original_end_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS hour_records (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      hours INTEGER NOT NULL,
      type TEXT NOT NULL,
      reference_id TEXT,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES course_packages(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS freeze_requests (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      request_idempotency_key TEXT UNIQUE,
      freeze_reason TEXT,
      freeze_days INTEGER NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'pending',
      approver_id TEXT,
      approved_at TEXT,
      rejected_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES course_packages(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS refund_requests (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      request_idempotency_key TEXT UNIQUE,
      refund_reason TEXT,
      refundable_hours INTEGER,
      refund_amount REAL,
      status TEXT DEFAULT 'pending',
      approved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES course_packages(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exception_logs (
      id TEXT PRIMARY KEY,
      package_id TEXT,
      student_id TEXT,
      operation TEXT,
      error_message TEXT,
      request_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
});

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync,
  uuidv4
};
