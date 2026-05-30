import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'traffic.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK(difficulty IN ('easy','medium','hard')),
    intersection_type TEXT NOT NULL,
    config TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES scenarios(id),
    player_name TEXT NOT NULL,
    phase_config TEXT NOT NULL DEFAULT '[]',
    vehicle_score INTEGER NOT NULL DEFAULT 0,
    pedestrian_score INTEGER NOT NULL DEFAULT 0,
    bus_score INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    passed INTEGER NOT NULL DEFAULT 0,
    risks TEXT NOT NULL DEFAULT '[]',
    win_reasons TEXT NOT NULL DEFAULT '[]',
    lose_reasons TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_games_scenario ON games(scenario_id);
  CREATE INDEX IF NOT EXISTS idx_games_player ON games(player_name);
  CREATE INDEX IF NOT EXISTS idx_games_created ON games(created_at);
`);

export default db;
