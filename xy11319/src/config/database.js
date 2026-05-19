const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/database.db');

let db = null;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        createTables()
          .then(() => resolve(db))
          .catch(reject);
      }
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS drivers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          driver_id VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          phone VARCHAR(20),
          id_card VARCHAR(50),
          status VARCHAR(20) DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS buses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bus_id VARCHAR(50) UNIQUE NOT NULL,
          plate_number VARCHAR(20) NOT NULL,
          route_name VARCHAR(100),
          capacity INTEGER,
          status VARCHAR(20) DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          parent_name VARCHAR(100),
          parent_phone VARCHAR(20),
          school_class VARCHAR(50),
          route_id VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS driver_checkins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          checkin_id VARCHAR(50) UNIQUE NOT NULL,
          driver_id VARCHAR(50) NOT NULL,
          bus_id VARCHAR(50) NOT NULL,
          checkin_time DATETIME NOT NULL,
          checkout_time DATETIME,
          location VARCHAR(200),
          latitude DECIMAL(10, 6),
          longitude DECIMAL(10, 6),
          checkin_type VARCHAR(20) DEFAULT 'morning',
          status VARCHAR(20) DEFAULT 'completed',
          import_batch_id VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (driver_id) REFERENCES drivers(driver_id),
          FOREIGN KEY (bus_id) REFERENCES buses(bus_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS gps_tracks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          track_id VARCHAR(50) UNIQUE NOT NULL,
          bus_id VARCHAR(50) NOT NULL,
          record_time DATETIME NOT NULL,
          latitude DECIMAL(10, 6) NOT NULL,
          longitude DECIMAL(10, 6) NOT NULL,
          speed DECIMAL(8, 2),
          heading INTEGER,
          satellites INTEGER,
          import_batch_id VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (bus_id) REFERENCES buses(bus_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS parent_complaints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          complaint_id VARCHAR(50) UNIQUE NOT NULL,
          student_id VARCHAR(50) NOT NULL,
          bus_id VARCHAR(50),
          complaint_date DATE NOT NULL,
          complaint_type VARCHAR(50) NOT NULL,
          description TEXT,
          expected_arrival TIME,
          actual_arrival TIME,
          status VARCHAR(20) DEFAULT 'pending',
          import_batch_id VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES students(student_id),
          FOREIGN KEY (bus_id) REFERENCES buses(bus_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS reconciliation_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reconciliation_id VARCHAR(50) UNIQUE NOT NULL,
          complaint_id VARCHAR(50) NOT NULL,
          bus_id VARCHAR(50) NOT NULL,
          driver_id VARCHAR(50),
          reconciliation_date DATE NOT NULL,
          checkin_time DATETIME,
          gps_arrival_time DATETIME,
          time_difference INTEGER,
          status VARCHAR(20) DEFAULT 'pending',
          result VARCHAR(50),
          responsibility VARCHAR(50),
          notes TEXT,
          reviewed_by VARCHAR(50),
          reviewed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES parent_complaints(complaint_id),
          FOREIGN KEY (bus_id) REFERENCES buses(bus_id),
          FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS import_batches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          batch_id VARCHAR(50) UNIQUE NOT NULL,
          batch_type VARCHAR(50) NOT NULL,
          file_name VARCHAR(255),
          total_records INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          failed_count INTEGER DEFAULT 0,
          status VARCHAR(20) DEFAULT 'processing',
          error_details TEXT,
          created_by VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS operation_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          log_id VARCHAR(50) UNIQUE NOT NULL,
          operator VARCHAR(50),
          operation_type VARCHAR(50) NOT NULL,
          target_type VARCHAR(50),
          target_id VARCHAR(50),
          details TEXT,
          ip_address VARCHAR(50),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

module.exports = {
  initDatabase,
  getDb,
  runQuery,
  getQuery,
  allQuery
};