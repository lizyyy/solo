import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'livehouse.db');
const db = new Database(dbPath);
export { db };

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS show_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_date TEXT NOT NULL,
      show_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      has_mixed_tickets INTEGER NOT NULL DEFAULT 0,
      needs_review INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ticket_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      ticket_type TEXT NOT NULL,
      ticket_number TEXT,
      attendee_name TEXT,
      price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (batch_id) REFERENCES show_batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conflict_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      conflict_type TEXT NOT NULL,
      sound_engineer_value TEXT NOT NULL,
      rehearsal_group_value TEXT NOT NULL,
      description TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_by TEXT,
      resolved_at TEXT,
      resolution TEXT,
      custom_value TEXT,
      FOREIGN KEY (batch_id) REFERENCES show_batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS revenue_split_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      total_tickets INTEGER NOT NULL DEFAULT 0,
      total_paid_tickets INTEGER NOT NULL DEFAULT 0,
      total_comp_tickets INTEGER NOT NULL DEFAULT 0,
      total_revenue REAL NOT NULL DEFAULT 0,
      bar_revenue REAL NOT NULL DEFAULT 0,
      venue_split REAL NOT NULL DEFAULT 0,
      artist_split REAL NOT NULL DEFAULT 0,
      calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (batch_id) REFERENCES show_batches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_ticket_records_batch_id ON ticket_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_conflict_evidence_batch_id ON conflict_evidence(batch_id);
    CREATE INDEX IF NOT EXISTS idx_revenue_split_results_batch_id ON revenue_split_results(batch_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_unique ON ticket_records(batch_id, source, ticket_number, attendee_name);
  `);
}
