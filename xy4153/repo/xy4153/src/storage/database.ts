import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.join(process.cwd(), 'water_quality.db');

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initializeDatabase(dbInstance);
  }
  return dbInstance;
}

function initializeDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      store_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pools (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      volume REAL NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    CREATE TABLE IF NOT EXISTS thresholds (
      id TEXT PRIMARY KEY,
      sample_type TEXT UNIQUE NOT NULL,
      min_value REAL NOT NULL,
      max_value REAL NOT NULL,
      unit TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_calibrations (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      calibration_date TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      calibrated_by TEXT NOT NULL,
      certificate_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    CREATE TABLE IF NOT EXISTS sample_records (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      pool_id TEXT NOT NULL,
      sample_type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      sample_time TEXT NOT NULL,
      recorded_by TEXT NOT NULL,
      device_calibration_id TEXT,
      is_exceeded INTEGER NOT NULL DEFAULT 0,
      ticket_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (pool_id) REFERENCES pools(id),
      FOREIGN KEY (device_calibration_id) REFERENCES device_calibrations(id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    );

    CREATE TABLE IF NOT EXISTS daily_reports (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      report_date TEXT NOT NULL,
      visitor_count INTEGER NOT NULL DEFAULT 0,
      water_change_records TEXT NOT NULL,
      temporary_closures TEXT NOT NULL,
      submitted_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id),
      UNIQUE(store_id, report_date)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      pool_id TEXT NOT NULL,
      sample_record_id TEXT NOT NULL,
      sample_type TEXT NOT NULL,
      exceeded_value REAL NOT NULL,
      threshold_min REAL NOT NULL,
      threshold_max REAL NOT NULL,
      status TEXT NOT NULL,
      assigned_to TEXT,
      rectification_description TEXT,
      rectification_evidence_urls TEXT,
      rectification_time TEXT,
      retest_sample_record_id TEXT,
      retest_value REAL,
      retest_time TEXT,
      retest_passed INTEGER,
      reopen_request_reason TEXT,
      reopen_request_time TEXT,
      reopened_by TEXT,
      close_reason TEXT,
      closed_time TEXT,
      closed_by TEXT,
      archived_time TEXT,
      archived_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (pool_id) REFERENCES pools(id),
      FOREIGN KEY (sample_record_id) REFERENCES sample_records(id),
      FOREIGN KEY (retest_sample_record_id) REFERENCES sample_records(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      user_role TEXT NOT NULL,
      before_state TEXT,
      after_state TEXT,
      changes TEXT,
      timestamp TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS version_records (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      UNIQUE(entity_type, entity_id, version)
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_store_id ON tickets(store_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_pool_id ON tickets(pool_id);
    CREATE INDEX IF NOT EXISTS idx_sample_records_store_id ON sample_records(store_id);
    CREATE INDEX IF NOT EXISTS idx_sample_records_pool_id ON sample_records(pool_id);
    CREATE INDEX IF NOT EXISTS idx_sample_records_sample_time ON sample_records(sample_time);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_version_records_entity ON version_records(entity_type, entity_id);
  `);

  const thresholdCount = db.prepare('SELECT COUNT(*) as count FROM thresholds').get() as { count: number };
  if (thresholdCount.count === 0) {
    const now = new Date().toISOString();
    const insertThreshold = db.prepare(`
      INSERT INTO thresholds (id, sample_type, min_value, max_value, unit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertThreshold.run(
      'threshold-chlorine-001',
      'chlorine',
      0.3,
      5.0,
      'mg/L',
      now,
      now
    );

    insertThreshold.run(
      'threshold-ph-001',
      'ph',
      7.0,
      7.8,
      'pH',
      now,
      now
    );

    insertThreshold.run(
      'threshold-turbidity-001',
      'turbidity',
      0.0,
      5.0,
      'NTU',
      now,
      now
    );
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
