import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data', 'parking.db');
const dbDir = join(process.cwd(), 'data');

import { mkdirSync } from 'fs';
mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS entry_records (
      id TEXT PRIMARY KEY,
      entry_time DATETIME NOT NULL,
      photo_url TEXT NOT NULL,
      parking_spot TEXT NOT NULL,
      plate_number TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY,
      payment_time DATETIME NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      transaction_id TEXT UNIQUE NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS match_records (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      payment_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      manual_note TEXT,
      matched_by TEXT,
      matched_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entry_records(id),
      FOREIGN KEY (payment_id) REFERENCES payment_records(id),
      UNIQUE(entry_id, payment_id)
    );

    CREATE TABLE IF NOT EXISTS match_histories (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      change_note TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES match_records(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_match_status ON match_records(status);
    CREATE INDEX IF NOT EXISTS idx_match_payment ON match_records(payment_id);
    CREATE INDEX IF NOT EXISTS idx_match_entry ON match_records(entry_id);
    CREATE INDEX IF NOT EXISTS idx_history_match ON match_histories(match_id);
  `);
}

export default db;
