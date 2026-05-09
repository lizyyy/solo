import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DB_PATH || './data/import-validator.db'

export let db: Database.Database

export function initDatabase() {
  const dbDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS validation_schemas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      fields TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_rows INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      schema_id TEXT NOT NULL,
      source_file TEXT,
      results_file TEXT,
      report_file TEXT,
      errors TEXT,
      FOREIGN KEY (schema_id) REFERENCES validation_schemas(id)
    );

    CREATE TABLE IF NOT EXISTS row_results (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      status TEXT NOT NULL,
      data TEXT NOT NULL,
      errors TEXT,
      created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_retried_at TEXT,
      FOREIGN KEY (job_id) REFERENCES import_jobs(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      format TEXT NOT NULL,
      created_at TEXT NOT NULL,
      file_path TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES import_jobs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_row_results_job_id ON row_results(job_id);
    CREATE INDEX IF NOT EXISTS idx_row_results_status ON row_results(status);
    CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
  `)

  return db
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}
