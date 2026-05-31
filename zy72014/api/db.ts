import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.resolve(__dirname, '../data/settlement.db')

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  createTables(_db)
  return _db
}

function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settlement (
      id TEXT PRIMARY KEY,
      anchor_id TEXT NOT NULL,
      anchor_name TEXT NOT NULL,
      total_tip REAL,
      refund_amount REAL,
      share_rate REAL,
      settlement_amount REAL,
      status TEXT NOT NULL DEFAULT 'needs_review',
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      has_empty_fields INTEGER NOT NULL DEFAULT 0,
      is_full_refund INTEGER NOT NULL DEFAULT 0,
      has_change_history INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_flow (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL REFERENCES settlement(id),
      transaction_id TEXT NOT NULL,
      amount REAL NOT NULL,
      time TEXT NOT NULL,
      platform TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refund_request (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL REFERENCES settlement(id),
      request_id TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approval_email (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL REFERENCES settlement(id),
      subject TEXT NOT NULL,
      raw_content TEXT NOT NULL,
      parsed_amount REAL,
      note TEXT NOT NULL DEFAULT '',
      received_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS handwritten_note (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL REFERENCES settlement(id),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS change_history (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL REFERENCES settlement(id),
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      operator TEXT NOT NULL DEFAULT '阿宁',
      created_at TEXT NOT NULL
    );
  `)
}

export { getDb }
