import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'data', 'bike_records.db');

export function initDatabase(): Database.Database {
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bike_records (
      id TEXT PRIMARY KEY,
      stationName TEXT NOT NULL,
      exitNo TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      timeSlot TEXT NOT NULL,
      bikeCount INTEGER NOT NULL,
      capacity INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      mergedFrom TEXT,
      reviewTime TEXT,
      createTime TEXT NOT NULL,
      updateTime TEXT NOT NULL,
      isOldCaliber INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      recordId TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      rawContent TEXT NOT NULL,
      importTime TEXT NOT NULL,
      FOREIGN KEY (recordId) REFERENCES bike_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      recordId TEXT NOT NULL,
      type TEXT NOT NULL,
      humanMessage TEXT NOT NULL,
      relatedRecordIds TEXT NOT NULL,
      details TEXT,
      FOREIGN KEY (recordId) REFERENCES bike_records(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sources_recordId ON sources(recordId);
    CREATE INDEX IF NOT EXISTS idx_conflicts_recordId ON conflicts(recordId);
    CREATE INDEX IF NOT EXISTS idx_records_status ON bike_records(status);
    CREATE INDEX IF NOT EXISTS idx_records_station ON bike_records(stationName, exitNo);
  `);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

export const db = initDatabase();
