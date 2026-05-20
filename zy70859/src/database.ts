import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'court-documents.db');

export async function initDatabase() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_number TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      description TEXT,
      total_materials INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      document_number TEXT NOT NULL,
      case_number TEXT,
      document_type TEXT,
      borrower TEXT,
      borrow_date DATE,
      return_date DATE,
      original_data TEXT,
      status TEXT DEFAULT 'pending',
      status_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS processing_trails (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      status_reason TEXT,
      processed_by TEXT NOT NULL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      note TEXT,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      modified_by TEXT NOT NULL,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      change_reason TEXT NOT NULL,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE INDEX IF NOT EXISTS idx_materials_batch_id ON materials(batch_id);
    CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
    CREATE INDEX IF NOT EXISTS idx_processing_trails_material_id ON processing_trails(material_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_material_id ON audit_logs(material_id);
  `);

  return db;
}

export type Database = Awaited<ReturnType<typeof initDatabase>>;
