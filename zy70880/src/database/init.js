const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        status TEXT DEFAULT 'pending',
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS meters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meter_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        zone_id INTEGER,
        multiplier REAL DEFAULT 1,
        multiplier_changed BOOLEAN DEFAULT 0,
        last_multiplier REAL,
        multiplier_change_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (zone_id) REFERENCES temperature_zones(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS meter_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        meter_id INTEGER NOT NULL,
        reading_date DATE NOT NULL,
        reading_value REAL NOT NULL,
        consumption REAL,
        multiplier REAL DEFAULT 1,
        actual_consumption REAL,
        is_peak_abnormal BOOLEAN DEFAULT 0,
        peak_reason TEXT,
        is_vacant_period BOOLEAN DEFAULT 0,
        vacant_reason TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (meter_id) REFERENCES meters(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS temperature_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        temperature_range TEXT,
        area REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        contact_person TEXT,
        contact_phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_no TEXT UNIQUE NOT NULL,
        tenant_id INTEGER NOT NULL,
        zone_id INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        allocation_ratio REAL NOT NULL,
        electricity_price REAL NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (zone_id) REFERENCES temperature_zones(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS processing_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reading_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        processed_by TEXT NOT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT,
        FOREIGN KEY (reading_id) REFERENCES meter_readings(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS allocation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        contract_id INTEGER NOT NULL,
        reading_id INTEGER NOT NULL,
        allocated_consumption REAL NOT NULL,
        allocated_amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (contract_id) REFERENCES contracts(id),
        FOREIGN KEY (reading_id) REFERENCES meter_readings(id)
      )`);

      console.log('所有表创建成功');
      resolve();
    });
  });
};

createTables().then(() => {
  db.close();
  process.exit(0);
}).catch((err) => {
  console.error('创建表失败:', err);
  db.close();
  process.exit(1);
});
