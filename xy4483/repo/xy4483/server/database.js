const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dayjs = require('dayjs');

const dbPath = path.join(__dirname, '..', 'data', 'air_quality.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        co2 REAL,
        pm25 REAL,
        tvoc REAL,
        UNIQUE(room, timestamp)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS ventilation_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        type TEXT NOT NULL CHECK(type IN ('window', 'fresh_air')),
        status TEXT DEFAULT 'active',
        notes TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS course_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        course_name TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        teacher TEXT,
        students_count INTEGER
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cleaning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('cleaning', 'disinfection')),
        staff TEXT,
        notes TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS risk_assessments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room TEXT NOT NULL,
        course_id INTEGER,
        assessment_time DATETIME NOT NULL,
        co2_level REAL,
        pm25_level REAL,
        tvoc_level REAL,
        peak_co2 REAL,
        peak_pm25 REAL,
        peak_tvoc REAL,
        ventilation_recovery_minutes INTEGER,
        risk_level TEXT CHECK(risk_level IN ('safe', 'warning', 'danger')),
        risk_reasons TEXT,
        can_proceed INTEGER DEFAULT 0,
        manual_override INTEGER DEFAULT 0,
        override_reason TEXT,
        notes TEXT,
        FOREIGN KEY (course_id) REFERENCES course_bookings(id)
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_room_time ON sensor_data(room, timestamp)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_ventilation_room ON ventilation_records(room, start_time)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_course_room ON course_bookings(room, start_time)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_assessment_room ON risk_assessments(room, assessment_time)`);
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  runQuery,
  getQuery,
  allQuery
};