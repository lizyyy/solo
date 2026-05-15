import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../data/synonym.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS synonym_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      synonyms TEXT NOT NULL,
      application_scope TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS synonym_versions (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      synonyms TEXT NOT NULL,
      application_scope TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      description TEXT,
      FOREIGN KEY (group_id) REFERENCES synonym_groups(id)
    );

    CREATE TABLE IF NOT EXISTS publish_batches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      approved_by TEXT,
      approved_at INTEGER,
      published_at INTEGER,
      rollbacked_at INTEGER,
      rollbacked_by TEXT,
      error_message TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS batch_items (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      FOREIGN KEY (batch_id) REFERENCES publish_batches(id),
      FOREIGN KEY (group_id) REFERENCES synonym_groups(id)
    );

    CREATE TABLE IF NOT EXISTS test_queries (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      query TEXT NOT NULL,
      expected_hits INTEGER,
      actual_hits_before INTEGER,
      actual_hits_after INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES synonym_groups(id)
    );

    CREATE TABLE IF NOT EXISTS hit_changes (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      query TEXT NOT NULL,
      hits_before INTEGER NOT NULL,
      hits_after INTEGER NOT NULL,
      change_percent REAL NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES publish_batches(id),
      FOREIGN KEY (group_id) REFERENCES synonym_groups(id)
    );

    CREATE TABLE IF NOT EXISTS rollback_audits (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      rollback_from_version INTEGER NOT NULL,
      rollback_to_version INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES publish_batches(id),
      FOREIGN KEY (group_id) REFERENCES synonym_groups(id)
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL,
      created_by TEXT NOT NULL
    );
  `);
}

export default db;
