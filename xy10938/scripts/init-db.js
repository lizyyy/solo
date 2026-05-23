const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dbConfig = require('../config/database');

const dataDir = path.dirname(dbConfig.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbConfig.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    level TEXT DEFAULT '普通会员',
    balance REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT '空闲',
    current_queue_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (current_queue_id) REFERENCES queue_numbers(id)
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_no TEXT UNIQUE NOT NULL,
    member_id INTEGER NOT NULL,
    service_type TEXT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TEXT NOT NULL,
    status TEXT DEFAULT '待确认',
    station_id INTEGER,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (station_id) REFERENCES stations(id)
  );

  CREATE TABLE IF NOT EXISTS queue_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_no TEXT UNIQUE NOT NULL,
    member_id INTEGER,
    appointment_id INTEGER,
    service_type TEXT NOT NULL,
    status TEXT DEFAULT '等待中',
    station_id INTEGER,
    position INTEGER NOT NULL,
    called_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (station_id) REFERENCES stations(id)
  );

  CREATE TABLE IF NOT EXISTS overnumber_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_id INTEGER NOT NULL,
    original_queue_no TEXT NOT NULL,
    new_queue_id INTEGER,
    reason TEXT NOT NULL,
    requeue_count INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (queue_id) REFERENCES queue_numbers(id),
    FOREIGN KEY (new_queue_id) REFERENCES queue_numbers(id)
  );

  CREATE TABLE IF NOT EXISTS exception_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_path TEXT NOT NULL,
    request_method TEXT NOT NULL,
    raw_input TEXT NOT NULL,
    error_message TEXT NOT NULL,
    handling_conclusion TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS queue_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date DATE UNIQUE NOT NULL,
    total_queue INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    overnumber_count INTEGER DEFAULT 0,
    avg_wait_time REAL DEFAULT 0,
    avg_service_time REAL DEFAULT 0,
    peak_hour TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_numbers(status);
  CREATE INDEX IF NOT EXISTS idx_queue_date ON queue_numbers(created_at);
  CREATE INDEX IF NOT EXISTS idx_appointment_date ON appointments(appointment_date);
  CREATE INDEX IF NOT EXISTS idx_exception_date ON exception_logs(created_at);
`);

console.log('数据库初始化完成！');
db.close();
