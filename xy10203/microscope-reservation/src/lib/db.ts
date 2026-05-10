import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || './data/microscope.db';

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS microscopes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model TEXT,
    location TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS accessories (
    id TEXT PRIMARY KEY,
    microscope_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (microscope_id) REFERENCES microscopes(id)
  );

  CREATE TABLE IF NOT EXISTS research_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    leader TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    group_id TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES research_groups(id)
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    microscope_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    submitted_at TEXT,
    approved_at TEXT,
    rejected_at TEXT,
    cancelled_at TEXT,
    approved_by TEXT,
    rejection_reason TEXT,
    FOREIGN KEY (microscope_id) REFERENCES microscopes(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES research_groups(id)
  );

  CREATE TABLE IF NOT EXISTS reservation_accessories (
    id TEXT PRIMARY KEY,
    reservation_id TEXT NOT NULL,
    accessory_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (accessory_id) REFERENCES accessories(id)
  );

  CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    user_id TEXT,
    timestamp TEXT NOT NULL,
    note TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_reservations_time ON reservations(start_time, end_time);
  CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
  CREATE INDEX IF NOT EXISTS idx_reservations_microscope ON reservations(microscope_id);
  CREATE INDEX IF NOT EXISTS idx_accessories_microscope ON accessories(microscope_id);
  CREATE INDEX IF NOT EXISTS idx_logs_entity ON operation_logs(entity_type, entity_id);
`);

export default db;
