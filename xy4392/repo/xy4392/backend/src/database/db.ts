import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/lighting-studio.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lighting_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      width REAL NOT NULL,
      depth REAL NOT NULL,
      height REAL NOT NULL,
      total_power REAL DEFAULT 0,
      max_power_limit REAL DEFAULT 5000,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS placed_lights (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      power REAL DEFAULT 0,
      color_temp INTEGER DEFAULT 5600,
      dmx_channel INTEGER,
      is_high_temp INTEGER DEFAULT 0,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 1.5,
      position_z REAL DEFAULT 0,
      rotation_x REAL DEFAULT 0,
      rotation_y REAL DEFAULT 0,
      rotation_z REAL DEFAULT 0,
      intensity REAL DEFAULT 1,
      color TEXT DEFAULT '#ffffff',
      stand_height REAL DEFAULT 2,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES lighting_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS actors (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      position_z REAL DEFAULT 0,
      rotation_x REAL DEFAULT 0,
      rotation_y REAL DEFAULT 0,
      rotation_z REAL DEFAULT 0,
      walk_path TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES lighting_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cameras (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 1.5,
      position_z REAL DEFAULT 0,
      rotation_x REAL DEFAULT 0,
      rotation_y REAL DEFAULT 0,
      rotation_z REAL DEFAULT 0,
      lens TEXT DEFAULT '50mm',
      fov REAL DEFAULT 60,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES lighting_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schedule_items (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      scene_id TEXT NOT NULL,
      scene_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      date TEXT NOT NULL,
      light_ids TEXT,
      camera_ids TEXT,
      actor_ids TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES lighting_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS risk_items (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      affected_items TEXT,
      is_overridden INTEGER DEFAULT 0,
      override_reason TEXT,
      override_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES lighting_plans(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_lights_plan ON placed_lights(plan_id);
    CREATE INDEX IF NOT EXISTS idx_actors_plan ON actors(plan_id);
    CREATE INDEX IF NOT EXISTS idx_cameras_plan ON cameras(plan_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_plan ON schedule_items(plan_id);
    CREATE INDEX IF NOT EXISTS idx_risks_plan ON risk_items(plan_id);
  `);
}

export default db;
