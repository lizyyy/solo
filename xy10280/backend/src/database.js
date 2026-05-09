const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'shuttle.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      direction TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      route_id INTEGER,
      sequence INTEGER,
      address TEXT,
      longitude REAL,
      latitude REAL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      employee_id TEXT NOT NULL UNIQUE,
      department TEXT,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      station_id INTEGER,
      route_id INTEGER,
      period TEXT NOT NULL,
      week_days TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS swipe_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      station_id INTEGER,
      route_id INTEGER,
      swipe_time DATETIME NOT NULL,
      direction TEXT,
      device_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS adjustment_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER,
      route_id INTEGER,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      heat_score REAL,
      registration_count INTEGER,
      actual_count INTEGER,
      difference_rate REAL,
      affected_employees INTEGER,
      proposal TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      reviewed_by TEXT,
      review_comment TEXT,
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS heat_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER,
      route_id INTEGER,
      period TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      registration_count INTEGER,
      actual_count INTEGER,
      difference_rate REAL,
      heat_level TEXT,
      suggestions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations(id),
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'adjustment',
      affected_routes TEXT,
      affected_stations TEXT,
      effective_date DATE,
      status TEXT DEFAULT 'draft',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      published_at DATETIME
    )`);

    console.log('数据库表初始化完成');
  });
}

module.exports = db;
