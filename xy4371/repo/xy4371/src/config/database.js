const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/vaccine.db');

let db = null;

function getDatabase() {
  if (!db) {
    db = new sqlite3.Database(dbPath);
  }
  return db;
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDatabase().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  const db = getDatabase();
  
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await runAsync(`
          CREATE TABLE IF NOT EXISTS containers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            container_id TEXT NOT NULL UNIQUE,
            container_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            is_spare INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await runAsync(`
          CREATE TABLE IF NOT EXISTS ice_packs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pack_id TEXT NOT NULL UNIQUE,
            container_id TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            frozen_status TEXT NOT NULL DEFAULT 'frozen',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await runAsync(`
          CREATE TABLE IF NOT EXISTS temperature_loggers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            logger_id TEXT NOT NULL UNIQUE,
            container_id TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await runAsync(`
          CREATE TABLE IF NOT EXISTS calibration_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            device_type TEXT NOT NULL,
            calibration_date DATE NOT NULL,
            expire_date DATE NOT NULL,
            certificate_number TEXT,
            calibration_agency TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await runAsync(`
          CREATE TABLE IF NOT EXISTS appointment_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_number TEXT NOT NULL UNIQUE,
            vaccine_name TEXT NOT NULL,
            expected_container_id TEXT,
            quantity INTEGER NOT NULL,
            appointment_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await runAsync(`
          CREATE TABLE IF NOT EXISTS batch_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_number TEXT NOT NULL,
            container_id TEXT NOT NULL,
            assignment_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(batch_number, container_id)
          )
        `);

        await runAsync(`
          CREATE TABLE IF NOT EXISTS temperature_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            logger_id TEXT NOT NULL,
            container_id TEXT,
            record_time DATETIME NOT NULL,
            temperature REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await runAsync(`
          CREATE INDEX IF NOT EXISTS idx_temp_logger ON temperature_records(logger_id)
        `);

        await runAsync(`
          CREATE INDEX IF NOT EXISTS idx_temp_time ON temperature_records(record_time)
        `);

        await runAsync(`
          CREATE TABLE IF NOT EXISTS risk_assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            risk_type TEXT NOT NULL,
            risk_level TEXT NOT NULL DEFAULT 'high',
            description TEXT NOT NULL,
            affected_item TEXT,
            affected_type TEXT,
            calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            review_status TEXT NOT NULL DEFAULT 'pending',
            review_comment TEXT,
            reviewer_name TEXT,
            reviewed_at DATETIME,
            UNIQUE(risk_type, affected_item, calculated_at)
          )
        `);

        await runAsync(`
          CREATE TABLE IF NOT EXISTS system_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_key TEXT NOT NULL UNIQUE,
            config_value TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        const configCheck = await getAsync("SELECT COUNT(*) as count FROM system_config");
        if (configCheck.count === 0) {
          await runAsync(`
            INSERT INTO system_config (config_key, config_value, description) VALUES
            ('min_temp', '2', '最低允许温度 (°C)'),
            ('max_temp', '8', '最高允许温度 (°C)'),
            ('required_spare_count', '2', '要求的备用箱数量'),
            ('calibration_warning_days', '30', '校准过期警告天数')
          `);
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = {
  getDatabase,
  runAsync,
  getAsync,
  allAsync,
  initDatabase
};
