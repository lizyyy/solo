import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'data', 'ledger.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(DB_PATH)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS ledger_records (
      id TEXT PRIMARY KEY,
      trade_no TEXT NOT NULL,
      institution_name_source1 TEXT NOT NULL,
      institution_name_source2 TEXT NOT NULL,
      institution_name_consistent INTEGER NOT NULL DEFAULT 1,
      ex_rights_date TEXT NOT NULL,
      extension_date TEXT NOT NULL,
      tax_rate REAL,
      tax_rate_remark TEXT DEFAULT '',
      tax_rate_source TEXT DEFAULT 'original',
      status TEXT NOT NULL DEFAULT 'normal',
      screenshot_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      cli_command TEXT NOT NULL,
      operator TEXT NOT NULL DEFAULT 'system',
      timestamp TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES ledger_records(id)
    );
    CREATE TABLE IF NOT EXISTS screenshots (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      data_url TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      FOREIGN KEY (record_id) REFERENCES ledger_records(id)
    );
    CREATE INDEX IF NOT EXISTS idx_records_status ON ledger_records(status);
    CREATE INDEX IF NOT EXISTS idx_logs_record_id ON operation_logs(record_id);
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON operation_logs(timestamp);
  `)

  return db
}
