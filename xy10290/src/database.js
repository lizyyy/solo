const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'campground.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS idempotent_requests (
  request_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  checksum TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campsites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS parking_spots (
  id TEXT PRIMARY KEY,
  campsite_id TEXT NOT NULL,
  spot_number TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (campsite_id) REFERENCES campsites(id)
);

CREATE TABLE IF NOT EXISTS utility_pillars (
  id TEXT PRIMARY KEY,
  campsite_id TEXT NOT NULL,
  pillar_code TEXT NOT NULL,
  water_fee_per_unit INTEGER NOT NULL DEFAULT 500,
  electric_fee_per_unit INTEGER NOT NULL DEFAULT 800,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (campsite_id) REFERENCES campsites(id)
);

CREATE TABLE IF NOT EXISTS pillar_spot_connections (
  id TEXT PRIMARY KEY,
  pillar_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (pillar_id) REFERENCES utility_pillars(id),
  FOREIGN KEY (spot_id) REFERENCES parking_spots(id),
  UNIQUE(pillar_id, spot_id)
);

CREATE TABLE IF NOT EXISTS stays (
  id TEXT PRIMARY KEY,
  campsite_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  check_in_time INTEGER NOT NULL,
  check_out_time INTEGER,
  deposit_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'CHECKED_IN',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (campsite_id) REFERENCES campsites(id),
  FOREIGN KEY (spot_id) REFERENCES parking_spots(id)
);

CREATE TABLE IF NOT EXISTS meter_readings (
  id TEXT PRIMARY KEY,
  pillar_id TEXT NOT NULL,
  reading_time INTEGER NOT NULL,
  water_reading INTEGER NOT NULL,
  electric_reading INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (pillar_id) REFERENCES utility_pillars(id)
);

CREATE TABLE IF NOT EXISTS utility_allocations (
  id TEXT PRIMARY KEY,
  stay_id TEXT NOT NULL,
  pillar_id TEXT NOT NULL,
  allocation_type TEXT NOT NULL,
  from_reading_id TEXT,
  to_reading_id TEXT NOT NULL,
  water_units INTEGER NOT NULL DEFAULT 0,
  electric_units INTEGER NOT NULL DEFAULT 0,
  water_cost INTEGER NOT NULL DEFAULT 0,
  electric_cost INTEGER NOT NULL DEFAULT 0,
  total_cost INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (stay_id) REFERENCES stays(id),
  FOREIGN KEY (pillar_id) REFERENCES utility_pillars(id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  stay_id TEXT NOT NULL,
  total_utility_cost INTEGER NOT NULL DEFAULT 0,
  deposit_used INTEGER NOT NULL DEFAULT 0,
  refund_amount INTEGER NOT NULL DEFAULT 0,
  additional_charge INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  discrepancy_reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (stay_id) REFERENCES stays(id)
);

CREATE TABLE IF NOT EXISTS issue_records (
  id TEXT PRIMARY KEY,
  issue_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  source_json TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'OPEN',
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolution_note TEXT
);

CREATE TABLE IF NOT EXISTS rule_violations (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  violation_details TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stays_spot ON stays(spot_id, status);
CREATE INDEX IF NOT EXISTS idx_stays_plate ON stays(vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_readings_pillar ON meter_readings(pillar_id, reading_time);
CREATE INDEX IF NOT EXISTS idx_allocations_stay ON utility_allocations(stay_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issue_records(status);
CREATE INDEX IF NOT EXISTS idx_violations_rule ON rule_violations(rule_id);
`);

module.exports = db;
