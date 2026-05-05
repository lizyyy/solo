const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'greenhouse.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS greenhouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seedbeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      greenhouse_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (greenhouse_id) REFERENCES greenhouses(id),
      UNIQUE(greenhouse_id, code)
    );

    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seedbed_id INTEGER,
      reading_date DATE NOT NULL,
      reading_time TIME,
      temperature REAL,
      humidity REAL,
      source_file TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seedbed_id) REFERENCES seedbeds(id)
    );

    CREATE TABLE IF NOT EXISTS plant_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seedbed_id INTEGER NOT NULL,
      plant_name TEXT NOT NULL,
      variety TEXT,
      batch_number TEXT,
      quantity INTEGER,
      planting_date DATE,
      expected_flowering_start DATE,
      expected_flowering_end DATE,
      pollination_type TEXT,
      is_isolated BOOLEAN DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seedbed_id) REFERENCES seedbeds(id)
    );

    CREATE TABLE IF NOT EXISTS pollination_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_batch_id INTEGER NOT NULL,
      plan_date DATE NOT NULL,
      target_plant TEXT,
      pollen_source TEXT,
      method TEXT,
      operator TEXT,
      priority TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plant_batch_id) REFERENCES plant_batches(id)
    );

    CREATE TABLE IF NOT EXISTS isolation_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seedbed_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_open BOOLEAN DEFAULT 0,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seedbed_id) REFERENCES seedbeds(id)
    );

    CREATE TABLE IF NOT EXISTS employee_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_date DATE NOT NULL,
      employee_name TEXT NOT NULL,
      shift_type TEXT,
      start_time TIME,
      end_time TIME,
      assigned_areas TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_date DATE NOT NULL,
      plant_batch_id INTEGER NOT NULL,
      is_suitable_pollination BOOLEAN,
      risk_type TEXT,
      risk_reason TEXT,
      temperature_risk TEXT,
      humidity_risk TEXT,
      cross_pollination_risk TEXT,
      flowering_stage TEXT,
      isolation_status TEXT,
      operator_available TEXT,
      manual_override BOOLEAN DEFAULT 0,
      override_reason TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plant_batch_id) REFERENCES plant_batches(id),
      UNIQUE(assessment_date, plant_batch_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sensor_date ON sensor_readings(reading_date);
    CREATE INDEX IF NOT EXISTS idx_batch_flowering ON plant_batches(expected_flowering_start, expected_flowering_end);
    CREATE INDEX IF NOT EXISTS idx_plan_date ON pollination_plans(plan_date);
    CREATE INDEX IF NOT EXISTS idx_assessment_date ON daily_assessments(assessment_date);
  `);
};

initTables();

module.exports = db;
