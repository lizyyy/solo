import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'beat-drift.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS audio_files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    duration REAL NOT NULL,
    sample_rate INTEGER NOT NULL,
    channels INTEGER NOT NULL DEFAULT 1,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS beat_points (
    id TEXT PRIMARY KEY,
    audio_id TEXT NOT NULL REFERENCES audio_files(id),
    voice_part TEXT NOT NULL DEFAULT 'default',
    time_ms REAL NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    is_manual INTEGER NOT NULL DEFAULT 0,
    corrected_from REAL
  );

  CREATE TABLE IF NOT EXISTS tempo_marks (
    id TEXT PRIMARY KEY,
    audio_id TEXT NOT NULL REFERENCES audio_files(id),
    time_ms REAL NOT NULL,
    bpm REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'stable',
    label TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS class_notes (
    id TEXT PRIMARY KEY,
    audio_id TEXT NOT NULL REFERENCES audio_files(id),
    time_ms_start REAL NOT NULL,
    time_ms_end REAL NOT NULL,
    content TEXT NOT NULL,
    screenshot_url TEXT,
    type TEXT NOT NULL DEFAULT 'text'
  );

  CREATE TABLE IF NOT EXISTS drift_analyses (
    id TEXT PRIMARY KEY,
    audio_id TEXT NOT NULL REFERENCES audio_files(id),
    voice_part TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'pending',
    reference_bpm REAL NOT NULL,
    drift_threshold REAL NOT NULL DEFAULT 50.0,
    min_segment_length REAL NOT NULL DEFAULT 4.0,
    confidence_threshold REAL NOT NULL DEFAULT 0.6
  );

  CREATE TABLE IF NOT EXISTS drift_results (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL UNIQUE REFERENCES drift_analyses(id),
    matched_beats TEXT NOT NULL DEFAULT '[]',
    drift_curve TEXT NOT NULL DEFAULT '[]',
    segments TEXT NOT NULL DEFAULT '[]',
    anomaly_regions TEXT NOT NULL DEFAULT '[]',
    audit_trail TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS error_causes (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL REFERENCES drift_analyses(id),
    type TEXT NOT NULL,
    time_ms_start REAL NOT NULL,
    time_ms_end REAL NOT NULL,
    reason TEXT NOT NULL,
    impact_score REAL NOT NULL,
    impact_range TEXT NOT NULL,
    affected_beat_ids TEXT NOT NULL DEFAULT '[]',
    next_action TEXT NOT NULL,
    next_action_reason TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT,
    resolution TEXT
  );

  CREATE TABLE IF NOT EXISTS drift_reports (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL REFERENCES drift_analyses(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    submission_type TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'draft',
    supplementary_reason TEXT,
    withdrawn_reason TEXT,
    duplicate_of TEXT
  );
`)

export default db
