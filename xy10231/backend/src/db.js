import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'matcher.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS lost_items (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  description TEXT,
  cleaned_description TEXT,
  lost_line TEXT,
  lost_station TEXT,
  lost_date TEXT,
  lost_time TEXT,
  item_category TEXT,
  item_color TEXT,
  item_features TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  raw_data TEXT
);

CREATE TABLE IF NOT EXISTS found_items (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  description TEXT,
  cleaned_description TEXT,
  found_line TEXT,
  found_station TEXT,
  found_date TEXT,
  found_time TEXT,
  item_category TEXT,
  item_color TEXT,
  item_features TEXT,
  finder TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  raw_data TEXT
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  lost_id TEXT,
  found_id TEXT,
  match_score REAL,
  match_stage TEXT,
  status TEXT DEFAULT 'candidate',
  confidence TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lost_id) REFERENCES lost_items(id),
  FOREIGN KEY (found_id) REFERENCES found_items(id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  match_id TEXT,
  feedback_type TEXT,
  feedback_note TEXT,
  operator TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id)
);

CREATE TABLE IF NOT EXISTS pipeline_status (
  id TEXT PRIMARY KEY,
  pipeline_name TEXT,
  status TEXT,
  current_stage TEXT,
  processed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  export_type TEXT,
  file_name TEXT,
  record_count INTEGER,
  pipeline_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pipeline_id) REFERENCES pipeline_status(id)
);

CREATE TABLE IF NOT EXISTS change_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT,
  entity_id TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  operator TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lost_status ON lost_items(status);
CREATE INDEX IF NOT EXISTS idx_found_status ON found_items(status);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_lost ON matches(lost_id);
CREATE INDEX IF NOT EXISTS idx_matches_found ON matches(found_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_name ON pipeline_status(pipeline_name);
`);

export default db;
