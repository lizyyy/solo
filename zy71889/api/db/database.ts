import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(__dirname, '../../data/lab.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDatabase(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS experiment_batches (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      version INTEGER NOT NULL DEFAULT 1,
      parent_batch_id TEXT,
      FOREIGN KEY (parent_batch_id) REFERENCES experiment_batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_batch_material_student ON experiment_batches(material_id, student_id);
    CREATE INDEX IF NOT EXISTS idx_batch_status ON experiment_batches(status);
    CREATE INDEX IF NOT EXISTS idx_batch_created_at ON experiment_batches(created_at);

    CREATE TABLE IF NOT EXISTS sensor_logs (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      temperature REAL,
      sphere_diameter REAL,
      fall_time REAL,
      fall_distance REAL,
      raw_data TEXT,
      FOREIGN KEY (batch_id) REFERENCES experiment_batches(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sensor_log_batch ON sensor_logs(batch_id);
    CREATE INDEX IF NOT EXISTS idx_sensor_log_timestamp ON sensor_logs(timestamp);

    CREATE TABLE IF NOT EXISTS experiment_records (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES experiment_batches(id)
    );

    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      points REAL,
      FOREIGN KEY (batch_id) REFERENCES experiment_batches(id)
    );

    CREATE TABLE IF NOT EXISTS manual_confirmations (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      content TEXT NOT NULL,
      confirmer TEXT NOT NULL,
      related_item_id TEXT,
      related_item_type TEXT,
      FOREIGN KEY (batch_id) REFERENCES experiment_batches(id)
    );

    CREATE TABLE IF NOT EXISTS viscosity_estimates (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      viscosity REAL,
      unit TEXT NOT NULL DEFAULT 'mPa·s',
      judgment TEXT NOT NULL,
      judgment_reason TEXT NOT NULL,
      judgment_steps TEXT NOT NULL,
      next_steps TEXT NOT NULL,
      raw_calculation TEXT NOT NULL,
      algorithm_version TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES experiment_batches(id)
    );

    CREATE TABLE IF NOT EXISTS grading_sheets (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      total_score REAL NOT NULL,
      max_score REAL NOT NULL,
      items TEXT NOT NULL,
      final_comment TEXT,
      FOREIGN KEY (batch_id) REFERENCES experiment_batches(id)
    );
  `);
}
