const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

const initDatabase = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('morning', 'evening'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      shift_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(date, shift_id, employee_id)
    );

    CREATE TABLE IF NOT EXISTS shift_exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_employee_id INTEGER NOT NULL,
      to_employee_id INTEGER NOT NULL,
      schedule_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      shift_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      processed_by INTEGER,
      FOREIGN KEY (from_employee_id) REFERENCES employees(id),
      FOREIGN KEY (to_employee_id) REFERENCES employees(id),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      FOREIGN KEY (processed_by) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      description TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const shiftCount = db.prepare('SELECT COUNT(*) as count FROM shifts').get().count;
  if (shiftCount === 0) {
    db.exec(`
      INSERT INTO shifts (name, start_time, end_time, type) VALUES
      ('早班', '08:00', '16:00', 'morning'),
      ('晚班', '16:00', '24:00', 'evening');
    `);
  }
};

initDatabase();

module.exports = db;
