import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;

export function initDB() {
  const dbPath = join(__dirname, '..', 'data', 'fire-training.db');
  db = new Database(dbPath);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS training_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      venue_geojson TEXT,
      fan_window_data TEXT,
      sensor_data TEXT
    );

    CREATE TABLE IF NOT EXISTS sensor_points (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL DEFAULT 0,
      type TEXT DEFAULT 'smoke',
      FOREIGN KEY (session_id) REFERENCES training_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS identified_issues (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      description TEXT NOT NULL,
      timestamp TEXT,
      location TEXT,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES training_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS review_notes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      issue_id TEXT,
      note_type TEXT DEFAULT 'general',
      content TEXT NOT NULL,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_resolved INTEGER DEFAULT 0,
      resolution TEXT,
      FOREIGN KEY (session_id) REFERENCES training_sessions(id),
      FOREIGN KEY (issue_id) REFERENCES identified_issues(id)
    );

    CREATE TABLE IF NOT EXISTS risk_results (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      risk_category TEXT NOT NULL,
      description TEXT,
      score REAL,
      recommendations TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES training_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS export_audit (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      export_type TEXT NOT NULL,
      export_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      export_data_hash TEXT,
      exported_by TEXT,
      FOREIGN KEY (session_id) REFERENCES training_sessions(id)
    );
  `);

  console.log('数据库初始化完成');
  return db;
}

export function getDB() {
  if (!db) {
    return initDB();
  }
  return db;
}
