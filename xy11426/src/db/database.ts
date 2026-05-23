import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: Database.Database | null = null;

export function getDbPath(): string {
  const configDir = path.join(process.cwd(), '.park-inspect');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, 'data.db');
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbPath = getDbPath();
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function initDatabase(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      strategy TEXT NOT NULL,
      operator TEXT NOT NULL,
      total_records INTEGER DEFAULT 0,
      valid_records INTEGER DEFAULT 0,
      invalid_records INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_batches_source ON import_batches(source_type);
    CREATE INDEX IF NOT EXISTS idx_batches_created ON import_batches(created_at);
    CREATE INDEX IF NOT EXISTS idx_batches_hash ON import_batches(file_hash);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS visitor_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      original_line_no INTEGER NOT NULL,
      visitor_name TEXT NOT NULL,
      visitor_phone TEXT,
      id_card TEXT,
      plate_number TEXT,
      visit_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      gate_passed INTEGER DEFAULT 0,
      pass_time TEXT,
      gate_no TEXT,
      status TEXT NOT NULL DEFAULT 'raw',
      check_result TEXT,
      raw_data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_records_batch ON visitor_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_records_source ON visitor_records(source_type);
    CREATE INDEX IF NOT EXISTS idx_records_visit ON visitor_records(visit_date);
    CREATE INDEX IF NOT EXISTS idx_records_status ON visitor_records(status);
    CREATE INDEX IF NOT EXISTS idx_records_plate ON visitor_records(plate_number);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS check_results (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      record_id TEXT NOT NULL,
      check_type TEXT NOT NULL,
      passed INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (record_id) REFERENCES visitor_records(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_checks_batch ON check_results(batch_id);
    CREATE INDEX IF NOT EXISTS idx_checks_record ON check_results(record_id);
    CREATE INDEX IF NOT EXISTS idx_checks_passed ON check_results(passed);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS async_tasks (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      task_type TEXT NOT NULL,
      status TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      error_message TEXT,
      error_stack TEXT,
      processed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON async_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_batch ON async_tasks(batch_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_created ON async_tasks(created_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      record_id TEXT,
      operator TEXT NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      ip TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES import_batches(id) ON DELETE SET NULL,
      FOREIGN KEY (record_id) REFERENCES visitor_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_batch ON audit_logs(batch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_logs(operator);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function isDatabaseInitialized(): boolean {
  try {
    const db = getDatabase();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='import_batches'").get();
    return !!row;
  } catch {
    return false;
  }
}
