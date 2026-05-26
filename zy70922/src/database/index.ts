import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'reconciliation.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let db: sqlite3.Database | null = null;

export function getDb(): sqlite3.Database {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Failed to connect to database:', err);
        throw err;
      }
      console.log('Connected to SQLite database');
    });
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
    db = null;
  }
}

export function runQuery(query: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    getDb().run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function getOne<T>(query: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    getDb().get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export function getAll<T>(query: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getDb().all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export async function initDatabase(): Promise<void> {
  const db = getDb();
  
  await new Promise<void>((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS import_records (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('csv', 'json')),
        filename TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        record_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        errors TEXT,
        imported_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sample_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        sample_no TEXT NOT NULL,
        sample_type TEXT,
        cooperative_id TEXT,
        cooperative_name TEXT,
        collection_date TEXT,
        quantity REAL,
        unit TEXT,
        received_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        raw_data TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(batch_id, sample_no)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_sample_batch ON sample_records(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sample_no ON sample_records(sample_no)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sample_status ON sample_records(status)`);

      db.run(`CREATE TABLE IF NOT EXISTS inspection_items (
        id TEXT PRIMARY KEY,
        sample_no TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        item_code TEXT NOT NULL,
        item_name TEXT NOT NULL,
        standard_value TEXT,
        actual_value TEXT,
        unit TEXT,
        result TEXT NOT NULL DEFAULT 'pending',
        is_retest INTEGER NOT NULL DEFAULT 0,
        retest_of TEXT,
        inspection_date TEXT,
        inspector TEXT,
        raw_data TEXT,
        created_at TEXT NOT NULL
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_sample ON inspection_items(sample_no, batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_item ON inspection_items(item_code)`);

      db.run(`CREATE TABLE IF NOT EXISTS retest_rules (
        id TEXT PRIMARY KEY,
        rule_code TEXT UNIQUE NOT NULL,
        rule_name TEXT NOT NULL,
        item_code TEXT,
        fail_threshold TEXT,
        retest_count INTEGER DEFAULT 1,
        retest_window_hours INTEGER DEFAULT 24,
        action_on_fail TEXT NOT NULL DEFAULT 'review',
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS reconciliations (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        total_samples INTEGER DEFAULT 0,
        matched_samples INTEGER DEFAULT 0,
        mismatched_samples INTEGER DEFAULT 0,
        pending_samples INTEGER DEFAULT 0,
        discrepancies_count INTEGER DEFAULT 0,
        resolved_discrepancies INTEGER DEFAULT 0,
        csv_import_id TEXT,
        json_import_id TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_reconciliation_batch ON reconciliations(batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_reconciliation_status ON reconciliations(status)`);

      db.run(`CREATE TABLE IF NOT EXISTS discrepancies (
        id TEXT PRIMARY KEY,
        reconciliation_id TEXT NOT NULL,
        sample_no TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        source_field TEXT,
        expected_value TEXT,
        actual_value TEXT,
        evidence TEXT NOT NULL,
        requires_manual_review INTEGER NOT NULL DEFAULT 1,
        resolved INTEGER NOT NULL DEFAULT 0,
        resolved_by TEXT,
        resolved_at TEXT,
        resolution_note TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (reconciliation_id) REFERENCES reconciliations(id)
      )`);

      db.run(`CREATE INDEX IF NOT EXISTS idx_discrepancy_reconciliation ON discrepancies(reconciliation_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_discrepancy_sample ON discrepancies(sample_no, batch_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_discrepancy_resolved ON discrepancies(resolved)`);

      db.run(`CREATE TABLE IF NOT EXISTS review_records (
        id TEXT PRIMARY KEY,
        reconciliation_id TEXT NOT NULL,
        sample_no TEXT NOT NULL,
        discrepancy_id TEXT,
        action TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        comment TEXT,
        previous_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (reconciliation_id) REFERENCES reconciliations(id)
      )`, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });

      db.run(`CREATE INDEX IF NOT EXISTS idx_review_reconciliation ON review_records(reconciliation_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_review_sample ON review_records(sample_no)`);
    });
  });

  console.log('Database initialized successfully');
}
