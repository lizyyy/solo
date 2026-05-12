const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'hospital_inspection.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`PRAGMA foreign_keys = ON`);

      db.run(`
        CREATE TABLE IF NOT EXISTS beds (
          id TEXT PRIMARY KEY,
          bed_number TEXT UNIQUE NOT NULL,
          ward TEXT NOT NULL,
          floor INTEGER NOT NULL,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS devices (
          id TEXT PRIMARY KEY,
          device_code TEXT UNIQUE NOT NULL,
          device_name TEXT NOT NULL,
          device_type TEXT NOT NULL,
          model TEXT,
          manufacturer TEXT,
          purchase_date DATE,
          status TEXT DEFAULT 'in_storage',
          current_bed_id TEXT,
          is_backup BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (current_bed_id) REFERENCES beds(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS inspections (
          id TEXT PRIMARY KEY,
          inspection_no TEXT UNIQUE NOT NULL,
          bed_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          inspector_id TEXT NOT NULL,
          inspector_name TEXT NOT NULL,
          inspection_time DATETIME NOT NULL,
          status TEXT DEFAULT 'normal',
          remarks TEXT,
          request_id TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bed_id) REFERENCES beds(id),
          FOREIGN KEY (device_id) REFERENCES devices(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS faults (
          id TEXT PRIMARY KEY,
          fault_no TEXT UNIQUE NOT NULL,
          device_id TEXT NOT NULL,
          bed_id TEXT NOT NULL,
          reporter_id TEXT NOT NULL,
          reporter_name TEXT NOT NULL,
          report_time DATETIME NOT NULL,
          fault_type TEXT NOT NULL,
          description TEXT NOT NULL,
          severity TEXT DEFAULT 'medium',
          status TEXT DEFAULT 'reported',
          replacement_device_id TEXT,
          resolved_time DATETIME,
          request_id TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (device_id) REFERENCES devices(id),
          FOREIGN KEY (bed_id) REFERENCES beds(id),
          FOREIGN KEY (replacement_device_id) REFERENCES devices(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS device_replacements (
          id TEXT PRIMARY KEY,
          replacement_no TEXT UNIQUE NOT NULL,
          fault_id TEXT NOT NULL,
          original_device_id TEXT NOT NULL,
          replacement_device_id TEXT NOT NULL,
          bed_id TEXT NOT NULL,
          operator_id TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          operation_time DATETIME NOT NULL,
          original_device_destination TEXT NOT NULL,
          request_id TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (fault_id) REFERENCES faults(id),
          FOREIGN KEY (original_device_id) REFERENCES devices(id),
          FOREIGN KEY (replacement_device_id) REFERENCES devices(id),
          FOREIGN KEY (bed_id) REFERENCES beds(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS disinfection_records (
          id TEXT PRIMARY KEY,
          disinfection_no TEXT UNIQUE NOT NULL,
          device_id TEXT NOT NULL,
          operator_id TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          disinfection_time DATETIME NOT NULL,
          disinfection_method TEXT NOT NULL,
          status TEXT DEFAULT 'completed',
          request_id TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (device_id) REFERENCES devices(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS device_recoveries (
          id TEXT PRIMARY KEY,
          recovery_no TEXT UNIQUE NOT NULL,
          device_id TEXT NOT NULL,
          operator_id TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          recovery_time DATETIME NOT NULL,
          remarks TEXT,
          request_id TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (device_id) REFERENCES devices(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS operation_history (
          id TEXT PRIMARY KEY,
          operation_type TEXT NOT NULL,
          operation_no TEXT NOT NULL,
          device_id TEXT,
          bed_id TEXT,
          operator_id TEXT NOT NULL,
          operator_name TEXT NOT NULL,
          operation_time DATETIME NOT NULL,
          before_state TEXT,
          after_state TEXT,
          request_id TEXT NOT NULL,
          is_reverted BOOLEAN DEFAULT 0,
          revert_time DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      resolve();
    });
  });
};

module.exports = { db, initDatabase };
