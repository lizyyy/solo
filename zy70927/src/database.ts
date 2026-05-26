import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: './training_cert.db',
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT UNIQUE NOT NULL,
      material_hash TEXT UNIQUE NOT NULL,
      submitted_by TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      material_index INTEGER NOT NULL,
      training_id TEXT,
      training_name TEXT,
      trainer TEXT,
      training_date TEXT,
      start_time TEXT,
      end_time TEXT,
      location TEXT,
      raw_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS attendance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      material_index INTEGER NOT NULL,
      attendance_index INTEGER NOT NULL,
      employee_id TEXT,
      employee_name TEXT,
      department TEXT,
      sign_in_time TEXT,
      sign_out_time TEXT,
      is_valid INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_id TEXT UNIQUE NOT NULL,
      batch_id TEXT NOT NULL,
      training_id TEXT NOT NULL,
      training_name TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      department TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      qr_code TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS validation_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      material_index INTEGER NOT NULL,
      attendance_index INTEGER,
      field TEXT NOT NULL,
      value TEXT,
      error TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS trace_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trace_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      training_id TEXT,
      employee_id TEXT,
      field_name TEXT NOT NULL,
      source TEXT NOT NULL,
      value TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      operator TEXT,
      remark TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_batches_hash ON batches(material_hash);
    CREATE INDEX IF NOT EXISTS idx_batches_id ON batches(batch_id);
    CREATE INDEX IF NOT EXISTS idx_certificates_id ON certificates(certificate_id);
    CREATE INDEX IF NOT EXISTS idx_trace_batch ON trace_logs(batch_id);
  `);

  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
