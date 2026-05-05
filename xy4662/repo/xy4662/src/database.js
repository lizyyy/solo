const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'water_quality.db');
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    batch_number TEXT NOT NULL UNIQUE,
    import_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    original_filename TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS sampling_points (
    id TEXT PRIMARY KEY,
    point_code TEXT NOT NULL UNIQUE,
    point_name TEXT,
    location TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS instruments (
    id TEXT PRIMARY KEY,
    instrument_code TEXT NOT NULL UNIQUE,
    instrument_name TEXT,
    model TEXT,
    last_calibration DATE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS water_samples (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    sample_code TEXT NOT NULL,
    bottle_code TEXT NOT NULL,
    sampling_point_id TEXT,
    sampling_time DATETIME,
    collector TEXT,
    sample_type TEXT,
    temperature REAL,
    ph REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (sampling_point_id) REFERENCES sampling_points(id)
  );

  CREATE TABLE IF NOT EXISTS instrument_readings (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    instrument_id TEXT,
    reading_type TEXT NOT NULL,
    reading_value REAL NOT NULL,
    reading_unit TEXT,
    reading_time DATETIME,
    operator TEXT,
    batch_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sample_id) REFERENCES water_samples(id),
    FOREIGN KEY (instrument_id) REFERENCES instruments(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  );

  CREATE TABLE IF NOT EXISTS recheck_notes (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    recheck_reason TEXT,
    recheck_operator TEXT,
    recheck_time DATETIME,
    original_value REAL,
    recheck_value REAL,
    conclusion TEXT,
    batch_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sample_id) REFERENCES water_samples(id),
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  );

  CREATE TABLE IF NOT EXISTS record_hashes (
    id TEXT PRIMARY KEY,
    record_type TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    bottle_code TEXT,
    content_hash TEXT NOT NULL,
    record_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(record_type, batch_number, bottle_code, content_hash)
  );

  CREATE TABLE IF NOT EXISTS rejected_records (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    record_type TEXT NOT NULL,
    original_content TEXT NOT NULL,
    error_reason TEXT NOT NULL,
    error_details TEXT,
    bottle_code TEXT,
    is_fixed BOOLEAN DEFAULT FALSE,
    fixed_by TEXT,
    fixed_at DATETIME,
    fixed_content TEXT,
    risk_level TEXT DEFAULT 'unknown',
    risk_score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
  );

  CREATE TABLE IF NOT EXISTS duplicate_records (
    id TEXT PRIMARY KEY,
    batch_number TEXT NOT NULL,
    bottle_code TEXT,
    record_type TEXT NOT NULL,
    existing_record_id TEXT NOT NULL,
    new_import_id TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    hash_match BOOLEAN DEFAULT TRUE
  );

  CREATE TABLE IF NOT EXISTS risk_assessments (
    id TEXT PRIMARY KEY,
    rejected_record_id TEXT NOT NULL,
    assessment_criteria TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    risk_score INTEGER NOT NULL,
    assessed_by TEXT,
    assessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (rejected_record_id) REFERENCES rejected_records(id)
  );

  CREATE INDEX IF NOT EXISTS idx_samples_bottle_code ON water_samples(bottle_code);
  CREATE INDEX IF NOT EXISTS idx_samples_batch_id ON water_samples(batch_id);
  CREATE INDEX IF NOT EXISTS idx_hashes_batch ON record_hashes(batch_number, record_type);
  CREATE INDEX IF NOT EXISTS idx_rejected_batch ON rejected_records(batch_id);
  CREATE INDEX IF NOT EXISTS idx_rejected_fixed ON rejected_records(is_fixed);
  CREATE INDEX IF NOT EXISTS idx_readings_sample ON instrument_readings(sample_id);
`);

module.exports = db;
