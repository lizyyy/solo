const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');

let db = null;

function getDatabase() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDatabase() {
  const database = getDatabase();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS visitor_appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_no TEXT UNIQUE,
      visitor_name TEXT,
      visitor_phone TEXT,
      id_card TEXT,
      license_plate TEXT,
      visit_date TEXT,
      visit_time_start TEXT,
      visit_time_end TEXT,
      visit_reason TEXT,
      visitor_company TEXT,
      host_department TEXT,
      host_name TEXT,
      status TEXT DEFAULT 'pending',
      gate_access INTEGER DEFAULT 0,
      temp_plate_access INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      source TEXT,
      source_id TEXT
    );

    CREATE TABLE IF NOT EXISTS gate_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT UNIQUE,
      gate_no TEXT,
      gate_name TEXT,
      visitor_name TEXT,
      license_plate TEXT,
      id_card TEXT,
      pass_time TEXT,
      pass_direction TEXT,
      pass_type TEXT,
      snapshot_url TEXT,
      temperature REAL,
      health_code_status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      source TEXT,
      source_id TEXT,
      appointment_no TEXT
    );

    CREATE TABLE IF NOT EXISTS license_plate_screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screenshot_no TEXT UNIQUE,
      license_plate TEXT,
      recognized_plate TEXT,
      confidence REAL,
      capture_time TEXT,
      capture_gate TEXT,
      image_url TEXT,
      ocr_result TEXT,
      manual_correction TEXT,
      is_correct INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      appointment_no TEXT,
      gate_record_no TEXT
    );

    CREATE TABLE IF NOT EXISTS compensation_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_id TEXT UNIQUE NOT NULL,
      fact_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_no TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 5,
      priority INTEGER DEFAULT 5,
      next_retry_at TEXT,
      last_retry_at TEXT,
      error_message TEXT,
      error_code TEXT,
      retryable INTEGER DEFAULT 1,
      created_by TEXT,
      assigned_to TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS fact_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fact_id TEXT UNIQUE NOT NULL,
      appointment_no TEXT,
      gate_record_no TEXT,
      screenshot_no TEXT,
      visitor_name TEXT,
      license_plate TEXT,
      visit_date TEXT,
      pass_time TEXT,
      status TEXT DEFAULT 'active',
      is_consistent INTEGER DEFAULT 1,
      consistency_score REAL DEFAULT 100,
      data_sources TEXT,
      latest_snapshot TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dirty_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id TEXT UNIQUE NOT NULL,
      record_type TEXT NOT NULL,
      record_no TEXT NOT NULL,
      fact_id TEXT,
      dirty_type TEXT NOT NULL,
      dirty_reason TEXT,
      severity TEXT DEFAULT 'medium',
      original_data TEXT NOT NULL,
      suggested_fix TEXT,
      status TEXT DEFAULT 'pending',
      handled_by TEXT,
      handled_at TEXT,
      handling_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS operation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_id TEXT UNIQUE NOT NULL,
      fact_id TEXT,
      queue_id TEXT,
      dirty_record_id TEXT,
      operation_type TEXT NOT NULL,
      operator TEXT,
      old_value TEXT,
      new_value TEXT,
      operation_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS manual_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT UNIQUE NOT NULL,
      fact_id TEXT NOT NULL,
      author TEXT NOT NULL,
      note_type TEXT NOT NULL,
      content TEXT NOT NULL,
      attachments TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dead_letter_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_id TEXT UNIQUE NOT NULL,
      original_queue_id TEXT NOT NULL,
      fact_id TEXT NOT NULL,
      record_type TEXT,
      record_no TEXT,
      final_error TEXT,
      retry_count INTEGER,
      moved_at TEXT DEFAULT CURRENT_TIMESTAMP,
      recovered_at TEXT,
      status TEXT DEFAULT 'dead'
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status ON compensation_queue(status, next_retry_at);
    CREATE INDEX IF NOT EXISTS idx_fact_appointment ON fact_records(appointment_no);
    CREATE INDEX IF NOT EXISTS idx_dirty_type ON dirty_records(dirty_type, status);
    CREATE INDEX IF NOT EXISTS idx_history_fact ON operation_history(fact_id, created_at);
  `);

  return database;
}

module.exports = {
  getDatabase,
  initDatabase
};
