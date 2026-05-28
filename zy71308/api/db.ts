import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '../data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'laser.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    min_energy_density REAL NOT NULL,
    max_energy_density REAL NOT NULL,
    recommended_power REAL NOT NULL,
    recommended_speed REAL NOT NULL,
    focal_range_min REAL NOT NULL,
    focal_range_max REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    laser_power REAL NOT NULL,
    move_speed REAL NOT NULL,
    focal_length REAL NOT NULL,
    line_width REAL NOT NULL,
    energy_density REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    is_retroactive INTEGER NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL DEFAULT 'safe',
    risk_messages TEXT NOT NULL DEFAULT '[]',
    operator TEXT NOT NULL DEFAULT '',
    reviewer TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (material_id) REFERENCES materials(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    operator TEXT NOT NULL DEFAULT '',
    changes TEXT NOT NULL DEFAULT '[]',
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (record_id) REFERENCES records(id)
  );
`)

const count = db.prepare('SELECT COUNT(*) as cnt FROM materials').get() as { cnt: number }
if (count.cnt === 0) {
  db.exec(`
    INSERT INTO materials (name, min_energy_density, max_energy_density, recommended_power, recommended_speed, focal_range_min, focal_range_max) VALUES
      ('木材', 0.5, 3.0, 30, 500, 0, 50),
      ('亚克力', 1.0, 5.0, 40, 300, 0, 30),
      ('皮革', 0.3, 2.5, 25, 600, 0, 40),
      ('纸张', 0.1, 1.5, 15, 800, 0, 20),
      ('玻璃', 5.0, 15.0, 80, 100, 0, 10),
      ('金属薄板', 8.0, 25.0, 100, 50, 0, 5);
  `)
}

export default db
