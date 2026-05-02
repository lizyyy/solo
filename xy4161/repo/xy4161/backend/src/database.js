import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, '../../data/denture.db');

let db;

export function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export function initDatabase() {
  const database = getDatabase();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      case_number TEXT UNIQUE NOT NULL,
      patient_name TEXT NOT NULL,
      doctor_name TEXT,
      clinic_name TEXT,
      status TEXT NOT NULL DEFAULT 'PRESCRIPTION_RECEIVED',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS teeth (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      tooth_number INTEGER NOT NULL,
      tooth_type TEXT NOT NULL,
      is_rework BOOLEAN NOT NULL DEFAULT 0,
      rework_count INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
      UNIQUE(case_id, tooth_number, version)
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      prescription_number TEXT UNIQUE NOT NULL,
      received_at DATETIME NOT NULL,
      doctor_name TEXT,
      tooth_numbers TEXT NOT NULL,
      restoration_type TEXT,
      material TEXT,
      shade TEXT,
      due_date DATE,
      notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scan_files (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      scan_type TEXT NOT NULL,
      scan_date DATE,
      version INTEGER NOT NULL DEFAULT 1,
      is_valid BOOLEAN NOT NULL DEFAULT 1,
      validation_errors TEXT,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS process_steps (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      tooth_id TEXT,
      step_name TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      started_at DATETIME,
      completed_at DATETIME,
      assigned_to TEXT,
      notes TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY (tooth_id) REFERENCES teeth(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rework_requests (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      tooth_id TEXT,
      request_date DATETIME NOT NULL,
      reason_code TEXT NOT NULL,
      reason_description TEXT NOT NULL,
      rework_type TEXT NOT NULL,
      requested_by TEXT,
      source_step TEXT NOT NULL,
      target_step TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by TEXT,
      reviewed_at DATETIME,
      review_notes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY (tooth_id) REFERENCES teeth(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS version_history (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      tooth_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      action TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      changed_by TEXT,
      change_reason TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY (tooth_id) REFERENCES teeth(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS try_in_feedbacks (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      tooth_id TEXT,
      feedback_date DATETIME NOT NULL,
      doctor_name TEXT,
      fit_status TEXT NOT NULL,
      occlusion_status TEXT,
      esthetics_status TEXT,
      notes TEXT,
      needs_rework BOOLEAN NOT NULL DEFAULT 0,
      rework_reason TEXT,
      is_followed_up BOOLEAN NOT NULL DEFAULT 0,
      followed_up_by TEXT,
      followed_up_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY (tooth_id) REFERENCES teeth(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
    CREATE INDEX IF NOT EXISTS idx_teeth_case_id ON teeth(case_id);
    CREATE INDEX IF NOT EXISTS idx_teeth_tooth_number ON teeth(tooth_number);
    CREATE INDEX IF NOT EXISTS idx_process_steps_case_id ON process_steps(case_id);
    CREATE INDEX IF NOT EXISTS idx_process_steps_status ON process_steps(status);
    CREATE INDEX IF NOT EXISTS idx_rework_requests_case_id ON rework_requests(case_id);
    CREATE INDEX IF NOT EXISTS idx_rework_requests_status ON rework_requests(status);
    CREATE INDEX IF NOT EXISTS idx_try_in_feedbacks_case_id ON try_in_feedbacks(case_id);
    CREATE INDEX IF NOT EXISTS idx_version_history_case_id ON version_history(case_id);
    CREATE INDEX IF NOT EXISTS idx_version_history_entity ON version_history(entity_type, entity_id);
  `);

  const triggers = `
    CREATE TRIGGER IF NOT EXISTS update_cases_updated_at 
    AFTER UPDATE ON cases
    BEGIN
      UPDATE cases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_teeth_updated_at 
    AFTER UPDATE ON teeth
    BEGIN
      UPDATE teeth SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_process_steps_updated_at 
    AFTER UPDATE ON process_steps
    BEGIN
      UPDATE process_steps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_rework_requests_updated_at 
    AFTER UPDATE ON rework_requests
    BEGIN
      UPDATE rework_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `;
  
  try {
    database.exec(triggers);
  } catch (e) {
    if (!e.message.includes('trigger already exists')) {
      throw e;
    }
  }

  return database;
}
