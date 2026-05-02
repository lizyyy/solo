const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test.db');

function setupTestDatabase() {
  const dataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const db = new Database(TEST_DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS instrument_packages (
      id TEXT PRIMARY KEY,
      package_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      instruments TEXT,
      current_status TEXT NOT NULL DEFAULT 'PENDING_CLEANING',
      expiration_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sterilization_cycles (
      id TEXT PRIMARY KEY,
      cycle_number TEXT UNIQUE NOT NULL,
      sterilizer_id TEXT NOT NULL,
      cycle_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
      target_temperature REAL NOT NULL,
      target_duration INTEGER NOT NULL,
      actual_temperature REAL,
      actual_duration INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parameter_curves (
      id TEXT PRIMARY KEY,
      cycle_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      temperature REAL NOT NULL,
      pressure REAL,
      humidity REAL,
      FOREIGN KEY (cycle_id) REFERENCES sterilization_cycles(id)
    );

    CREATE TABLE IF NOT EXISTS quality_checks (
      id TEXT PRIMARY KEY,
      cycle_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      check_type TEXT NOT NULL,
      result TEXT NOT NULL,
      notes TEXT,
      checked_by TEXT,
      checked_at TEXT NOT NULL,
      FOREIGN KEY (cycle_id) REFERENCES sterilization_cycles(id),
      FOREIGN KEY (package_id) REFERENCES instrument_packages(id)
    );

    CREATE TABLE IF NOT EXISTS department_usage (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      department TEXT NOT NULL,
      user_name TEXT,
      usage_time TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (package_id) REFERENCES instrument_packages(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT,
      performed_by TEXT,
      performed_at TEXT NOT NULL
    );
  `);

  return db;
}

function cleanupTestDatabase() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

module.exports = {
  setupTestDatabase,
  cleanupTestDatabase,
  TEST_DB_PATH
};
