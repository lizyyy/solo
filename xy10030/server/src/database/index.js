import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.join(dbDir, 'events.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      location TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 0,
      current_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (status IN ('draft', 'published', 'cancelled', 'completed'))
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      request_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id),
      CHECK (status IN ('pending', 'confirmed', 'cancelled')),
      UNIQUE (request_id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT DEFAULT 'system',
      old_data TEXT,
      new_data TEXT,
      reason TEXT,
      request_id TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (entity_type IN ('event', 'registration', 'task')),
      CHECK (action IN ('create', 'update', 'cancel', 'delete', 'retry', 'confirm')),
      CHECK (status IN ('success', 'failed'))
    );

    CREATE TABLE IF NOT EXISTS failed_tasks (
      id TEXT PRIMARY KEY,
      task_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      data TEXT NOT NULL,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'pending',
      last_retry_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (status IN ('pending', 'retrying', 'completed', 'failed'))
    );

    CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_request_id ON registrations(request_id);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_entity ON operation_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_operation_logs_request_id ON operation_logs(request_id);
    CREATE INDEX IF NOT EXISTS idx_failed_tasks_status ON failed_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
  `);

  console.log('Database initialized successfully');
  return db;
}

export function getDb() {
  return db;
}

export { db };
