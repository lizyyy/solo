const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'delivery.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    tracking_number TEXT UNIQUE NOT NULL,
    sender TEXT,
    receiver TEXT,
    origin TEXT,
    destination TEXT,
    status TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS package_tracks (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    location TEXT,
    status TEXT,
    description TEXT,
    operator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS package_track_history (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    operator TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES package_tracks(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS branch_shifts (
    id TEXT PRIMARY KEY,
    branch_name TEXT NOT NULL,
    shift_code TEXT UNIQUE NOT NULL,
    shift_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    manager TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS branch_shift_history (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    operator TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_id) REFERENCES branch_shifts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS driver_handovers (
    id TEXT PRIMARY KEY,
    shift_id TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    driver_phone TEXT,
    vehicle_number TEXT,
    handover_time DATETIME,
    package_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    operator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shift_id) REFERENCES branch_shifts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS driver_handover_history (
    id TEXT PRIMARY KEY,
    handover_id TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    operator TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (handover_id) REFERENCES driver_handovers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS misclassification_records (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    misclassified_branch TEXT NOT NULL,
    correct_branch TEXT NOT NULL,
    found_time DATETIME NOT NULL,
    reporter TEXT,
    status TEXT DEFAULT 'pending',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES packages(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reassignments (
    id TEXT PRIMARY KEY,
    misclassification_id TEXT NOT NULL,
    handler TEXT NOT NULL,
    reassign_time DATETIME NOT NULL,
    new_route TEXT,
    status TEXT DEFAULT 'processing',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (misclassification_id) REFERENCES misclassification_records(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS compensations (
    id TEXT PRIMARY KEY,
    misclassification_id TEXT UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    responsible_person TEXT NOT NULL,
    approve_time DATETIME,
    status TEXT DEFAULT 'pending',
    request_id TEXT UNIQUE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (misclassification_id) REFERENCES misclassification_records(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    operation_type TEXT NOT NULL,
    target_id TEXT,
    target_type TEXT,
    operator TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_packages_tracking_number ON packages(tracking_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_package_tracks_package_id ON package_tracks(package_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_misclassification_package_id ON misclassification_records(package_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compensations_request_id ON compensations(request_id)`);
});

module.exports = db;
