import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'bills.db');

let db: Database.Database;

export function initDatabase(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = FULL');

  initSchema();
  return db;
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups_table (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      members TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CNY',
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      participants TEXT NOT NULL,
      tags TEXT,
      deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      previous_version INTEGER NOT NULL,
      new_version INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      client_id TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      correlation_id TEXT,
      sequence INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_aggregate ON events(aggregate_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);

    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      event_id1 TEXT NOT NULL,
      event_id2 TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      resolution TEXT,
      detected_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conflicts_aggregate ON conflicts(aggregate_id);
    CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);

    CREATE TABLE IF NOT EXISTS sync_state (
      id TEXT PRIMARY KEY DEFAULT 'main',
      last_synced_at INTEGER NOT NULL DEFAULT 0,
      pending_events TEXT NOT NULL DEFAULT '[]',
      sync_status TEXT NOT NULL DEFAULT 'idle',
      server_version INTEGER NOT NULL DEFAULT 0,
      local_version INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      ttl INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_cache_ttl ON cache(ttl) WHERE ttl IS NOT NULL;
  `);

  const syncRow = db.prepare('SELECT * FROM sync_state WHERE id = ?').get('main');
  if (!syncRow) {
    db.prepare(`
      INSERT INTO sync_state (last_synced_at, pending_events, sync_status, server_version, local_version)
      VALUES (?, ?, ?, ?, ?)
    `).run(Date.now(), '[]', 'idle', 0, 0);
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export function executeTransaction<T>(fn: () => T): T {
  const db = getDatabase();
  const transaction = db.transaction(fn);
  return transaction();
}
