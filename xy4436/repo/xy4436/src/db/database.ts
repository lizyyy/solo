import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';

const DB_DIR = path.join(process.cwd(), '.light-checker');
const DB_PATH = path.join(DB_DIR, 'data.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    fs.ensureDirSync(DB_DIR);
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    initializeTables(dbInstance);
  }
  return dbInstance;
}

function initializeTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      venue TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fixtures (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      dmx_start_address INTEGER NOT NULL,
      dmx_channel_count INTEGER NOT NULL,
      universe INTEGER DEFAULT 1,
      power INTEGER DEFAULT 0,
      circuit_id TEXT,
      note TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      cue_number TEXT NOT NULL,
      name TEXT,
      description TEXT,
      media_references TEXT,
      note TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS circuits (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      max_power INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      note TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      file_type TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS banned_devices (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      reason TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      affected_items TEXT,
      resolved INTEGER DEFAULT 0,
      resolution_note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_fixtures_project ON fixtures(project_id);
    CREATE INDEX IF NOT EXISTS idx_cues_project ON cues(project_id);
    CREATE INDEX IF NOT EXISTS idx_circuits_project ON circuits(project_id);
    CREATE INDEX IF NOT EXISTS idx_media_project ON media_files(project_id);
    CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id);
    CREATE INDEX IF NOT EXISTS idx_issues_resolved ON issues(resolved);
  `);
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export { DB_DIR, DB_PATH };
