const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/schoolbus.db');

let dbInstance = null;

function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initializeTables(db);
  dbInstance = db;
  return db;
}

function initializeTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lines (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stops (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      line_id TEXT NOT NULL,
      stop_order INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (line_id) REFERENCES lines(id),
      UNIQUE(line_id, code)
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      grade TEXT,
      class TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_lines (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      line_id TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      default_stop_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (line_id) REFERENCES lines(id),
      FOREIGN KEY (stop_id) REFERENCES stops(id),
      FOREIGN KEY (default_stop_id) REFERENCES stops(id),
      UNIQUE(student_id, line_id)
    );

    CREATE TABLE IF NOT EXISTS parents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      relationship TEXT NOT NULL,
      student_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      UNIQUE(student_id, phone)
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      driver_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      license_plate TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS driver_assignments (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      line_id TEXT NOT NULL,
      shift_id TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (driver_id) REFERENCES drivers(id),
      FOREIGN KEY (line_id) REFERENCES lines(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id),
      UNIQUE(driver_id, line_id, shift_id, effective_date)
    );

    CREATE TABLE IF NOT EXISTS diversions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      reason TEXT NOT NULL,
      diversion_type TEXT DEFAULT 'temporary',
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diversion_lines (
      id TEXT PRIMARY KEY,
      diversion_id TEXT NOT NULL,
      line_id TEXT NOT NULL,
      original_stop_id TEXT NOT NULL,
      new_stop_id TEXT,
      is_skipped INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (diversion_id) REFERENCES diversions(id),
      FOREIGN KEY (line_id) REFERENCES lines(id),
      FOREIGN KEY (original_stop_id) REFERENCES stops(id),
      FOREIGN KEY (new_stop_id) REFERENCES stops(id)
    );

    CREATE TABLE IF NOT EXISTS leaves (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      date TEXT NOT NULL,
      leave_type TEXT DEFAULT 'full',
      note TEXT,
      status TEXT DEFAULT 'approved',
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      UNIQUE(student_id, date)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      diversion_id TEXT NOT NULL,
      parent_id TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'generated',
      created_at TEXT NOT NULL,
      sent_at TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (diversion_id) REFERENCES diversions(id),
      FOREIGN KEY (parent_id) REFERENCES parents(id),
      UNIQUE(student_id, diversion_id, parent_id, notification_type)
    );
  `);
}

function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  getDatabase,
  closeDatabase
};
