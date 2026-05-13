const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'prototype_tracking.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS parts (
    id TEXT PRIMARY KEY,
    part_number TEXT NOT NULL,
    prototype_version TEXT NOT NULL,
    part_name TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(part_number, prototype_version)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inspection_reports (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    report_number TEXT NOT NULL,
    inspector TEXT,
    inspection_date DATETIME,
    result TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS installation_records (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    vehicle_number TEXT,
    installation_date DATETIME,
    installer TEXT,
    location TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rework_processes (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    process_name TEXT NOT NULL,
    operator TEXT,
    start_time DATETIME,
    end_time DATETIME,
    result TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS scrap_records (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    scrap_date DATETIME,
    reason TEXT,
    responsible_person TEXT,
    disposal_location TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS status_history (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    change_reason TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS modification_history (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    modified_by TEXT,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_parts_number ON parts(part_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_parts_status ON parts(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_part ON status_history(part_id)`);
});

module.exports = db;
