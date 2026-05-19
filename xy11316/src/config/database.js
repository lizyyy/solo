const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS stops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stop_id TEXT NOT NULL UNIQUE,
        stop_name TEXT NOT NULL,
        route_id TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS gps_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        plate_number TEXT,
        driver_id TEXT,
        driver_name TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp DATETIME NOT NULL,
        speed REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT NOT NULL UNIQUE,
        parent_name TEXT NOT NULL,
        parent_phone TEXT,
        student_name TEXT NOT NULL,
        stop_id TEXT,
        stop_name TEXT,
        route_id TEXT,
        complaint_type TEXT NOT NULL,
        complaint_time DATETIME NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        handler TEXT,
        handled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS import_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_type TEXT NOT NULL,
        raw_data TEXT NOT NULL,
        row_number INTEGER,
        error_message TEXT NOT NULL,
        suggestion TEXT,
        resolved BOOLEAN DEFAULT 0,
        resolved_by TEXT,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS anomaly_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        anomaly_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        route_id TEXT,
        stop_id TEXT,
        stop_name TEXT,
        complaint_id TEXT,
        gps_record_id INTEGER,
        driver_id TEXT,
        driver_name TEXT,
        scheduled_time TEXT,
        actual_time DATETIME,
        delay_minutes INTEGER,
        distance_from_stop REAL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        handler TEXT,
        handled_at DATETIME,
        responsibility TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS processing_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        processing_type TEXT NOT NULL,
        record_count INTEGER DEFAULT 0,
        anomaly_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        started_at DATETIME,
        finished_at DATETIME,
        status TEXT DEFAULT 'completed',
        details TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driver_id TEXT NOT NULL UNIQUE,
        driver_name TEXT NOT NULL,
        phone TEXT,
        plate_number TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('数据库表初始化完成');
  });
}

module.exports = db;
