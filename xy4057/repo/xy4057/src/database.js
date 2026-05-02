const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'sterilization.db');

let db = null;

function initDatabase() {
  const fs = require('fs');
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);

  db.exec(`
    -- 器械包表
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

    -- 灭菌锅次表
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

    -- 参数曲线表
    CREATE TABLE IF NOT EXISTS parameter_curves (
      id TEXT PRIMARY KEY,
      cycle_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      temperature REAL NOT NULL,
      pressure REAL,
      humidity REAL,
      FOREIGN KEY (cycle_id) REFERENCES sterilization_cycles(id)
    );

    -- 质检结果表
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

    -- 科室领用表
    CREATE TABLE IF NOT EXISTS department_usage (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      department TEXT NOT NULL,
      user_name TEXT,
      usage_time TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (package_id) REFERENCES instrument_packages(id)
    );

    -- 审计日志表
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT,
      performed_by TEXT,
      performed_at TEXT NOT NULL
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_packages_status ON instrument_packages(current_status);
    CREATE INDEX IF NOT EXISTS idx_packages_number ON instrument_packages(package_number);
    CREATE INDEX IF NOT EXISTS idx_cycles_number ON sterilization_cycles(cycle_number);
    CREATE INDEX IF NOT EXISTS idx_curves_cycle ON parameter_curves(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(performed_at);
  `);

  return db;
}

function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

function generateId() {
  return uuidv4();
}

function getCurrentTime() {
  return new Date().toISOString();
}

module.exports = {
  initDatabase,
  getDatabase,
  generateId,
  getCurrentTime,
  DB_PATH
};
