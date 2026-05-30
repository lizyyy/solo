import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', '..', 'data', 'app.db');

const dataDir = join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const ddl = `
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  artist TEXT NOT NULL,
  duration INTEGER NOT NULL,
  stamina_level INTEGER NOT NULL CHECK (stamina_level BETWEEN 1 AND 5),
  notes TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  track_id TEXT REFERENCES tracks(id),
  track_name TEXT NOT NULL,
  voter_id TEXT,
  voter_name TEXT,
  voted_at TEXT NOT NULL,
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  duplicate_of TEXT REFERENCES votes(id),
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS copyrights (
  id TEXT PRIMARY KEY,
  track_id TEXT REFERENCES tracks(id),
  track_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'pending', 'restricted')),
  expired_at TEXT,
  warning_level TEXT NOT NULL DEFAULT 'low' CHECK (warning_level IN ('high', 'medium', 'low')),
  license_number TEXT,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  selected_track_ids TEXT NOT NULL,
  total_duration INTEGER NOT NULL,
  total_votes INTEGER NOT NULL,
  avg_stamina REAL NOT NULL,
  copyright_risk TEXT NOT NULL CHECK (copyright_risk IN ('none', 'low', 'medium', 'high')),
  filters TEXT NOT NULL,
  deduplication_rules TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  decision_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL DEFAULT 'local'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'import', 'decision', 'export')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('track', 'vote', 'copyright', 'decision')),
  entity_id TEXT,
  before_change TEXT,
  after_change TEXT,
  operator TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT
);

CREATE TABLE IF NOT EXISTS bad_data (
  id TEXT PRIMARY KEY,
  source_file TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  raw_content TEXT NOT NULL,
  error_type TEXT NOT NULL CHECK (error_type IN ('missing_field', 'invalid_format', 'invalid_duration', 'duplicate', 'unknown_track')),
  error_message TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  import_session TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_tracks (
  decision_id TEXT REFERENCES decisions(id),
  track_id TEXT REFERENCES tracks(id),
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (decision_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_track_id ON votes(track_id);
CREATE INDEX IF NOT EXISTS idx_votes_is_duplicate ON votes(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_copyrights_track_id ON copyrights(track_id);
CREATE INDEX IF NOT EXISTS idx_copyrights_warning_level ON copyrights(warning_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_bad_data_import_session ON bad_data(import_session);
`;

db.exec(ddl);

export default db;
