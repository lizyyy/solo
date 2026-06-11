import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/construction-plans.db');

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      plan_no TEXT UNIQUE NOT NULL,
      project_name TEXT NOT NULL,
      original_opinion TEXT NOT NULL,
      original_source TEXT NOT NULL,
      current_remark TEXT DEFAULT '',
      judgment TEXT CHECK(judgment IN ('approved', 'rejected', 'pending')) DEFAULT 'pending',
      status TEXT CHECK(status IN ('normal', 'abnormal')) DEFAULT 'normal',
      material_batch TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history_versions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      version TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      change_reason TEXT,
      operator TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_batches (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      material_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      is_supplement BOOLEAN DEFAULT 0,
      supplement_reason TEXT,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_history_plan_id ON history_versions(plan_id);
    CREATE INDEX IF NOT EXISTS idx_material_plan_id ON material_batches(plan_id);
    CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
    CREATE INDEX IF NOT EXISTS idx_plans_judgment ON plans(judgment);
  `);

  console.log('Database initialized successfully');
}
