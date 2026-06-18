import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'coral.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS survey_records (
    id TEXT PRIMARY KEY,
    site_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    sample_time TEXT NOT NULL,
    experiment_result TEXT NOT NULL,
    bleaching_level INTEGER NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('original', 'retroactive_note')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    record_id TEXT NOT NULL REFERENCES survey_records(id) ON DELETE CASCADE,
    annotator TEXT NOT NULL,
    content TEXT NOT NULL,
    annotation_time TEXT NOT NULL DEFAULT (datetime('now')),
    is_retroactive INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS report_runs (
    id TEXT PRIMARY KEY,
    run_time TEXT NOT NULL DEFAULT (datetime('now')),
    parameter_snapshot_id TEXT REFERENCES parameter_snapshots(id),
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
    total_records INTEGER NOT NULL DEFAULT 0,
    anomaly_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS parameter_snapshots (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES report_runs(id),
    snapshot_time TEXT NOT NULL DEFAULT (datetime('now')),
    parameters TEXT NOT NULL,
    changed_from TEXT,
    change_step INTEGER NOT NULL DEFAULT 0,
    impact_summary TEXT
  );

  CREATE TABLE IF NOT EXISTS anomaly_records (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES report_runs(id),
    record_id TEXT NOT NULL REFERENCES survey_records(id),
    anomaly_type TEXT NOT NULL CHECK(anomaly_type IN ('time_mismatch', 'coordinate_swap', 'bleaching_anomaly', 'data_gap')),
    severity TEXT NOT NULL CHECK(severity IN ('critical', 'warning', 'info')),
    description TEXT NOT NULL,
    trace_chain TEXT NOT NULL,
    summary_mapping TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'acknowledged', 'resolved'))
  );

  CREATE TABLE IF NOT EXISTS coordinate_corrections (
    id TEXT PRIMARY KEY,
    anomaly_id TEXT NOT NULL REFERENCES anomaly_records(id) ON DELETE CASCADE,
    original_lat REAL NOT NULL,
    original_lng REAL NOT NULL,
    corrected_lat REAL NOT NULL,
    corrected_lng REAL NOT NULL,
    persisted_to_detail INTEGER NOT NULL DEFAULT 0,
    persisted_to_file INTEGER NOT NULL DEFAULT 0,
    corrected_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_annotations_record_id ON annotations(record_id);
  CREATE INDEX IF NOT EXISTS idx_anomaly_records_run_id ON anomaly_records(run_id);
  CREATE INDEX IF NOT EXISTS idx_anomaly_records_record_id ON anomaly_records(record_id);
  CREATE INDEX IF NOT EXISTS idx_anomaly_records_type ON anomaly_records(anomaly_type);
  CREATE INDEX IF NOT EXISTS idx_parameter_snapshots_run_id ON parameter_snapshots(run_id);
  CREATE INDEX IF NOT EXISTS idx_coordinate_corrections_anomaly_id ON coordinate_corrections(anomaly_id);
  CREATE INDEX IF NOT EXISTS idx_survey_records_source_type ON survey_records(source_type);
`)

export default db
