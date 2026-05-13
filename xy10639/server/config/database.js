const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/shuttle.db');
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
      route_name TEXT NOT NULL,
      route_code TEXT UNIQUE NOT NULL,
      direction TEXT NOT NULL,
      capacity INTEGER DEFAULT 45,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      station_name TEXT NOT NULL,
      station_order INTEGER NOT NULL,
      arrival_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      station_id INTEGER NOT NULL,
      reservation_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS waitlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      station_id INTEGER NOT NULL,
      reservation_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'waiting',
      promoted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (station_id) REFERENCES stations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS credit_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      type TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      operator_id TEXT,
      operator_name TEXT,
      related_reservation_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (related_reservation_id) REFERENCES reservations(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS temp_buses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      bus_number TEXT NOT NULL,
      capacity INTEGER DEFAULT 45,
      driver_name TEXT,
      effective_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      reason TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS daily_load_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      stat_date DATE NOT NULL,
      time_slot TEXT NOT NULL,
      base_capacity INTEGER NOT NULL,
      temp_capacity INTEGER DEFAULT 0,
      total_capacity INTEGER NOT NULL,
      reserved_count INTEGER NOT NULL,
      waitlist_promoted_count INTEGER DEFAULT 0,
      no_show_deduction INTEGER DEFAULT 0,
      final_load_rate REAL NOT NULL,
      calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER,
      exception_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT NOT NULL,
      reason TEXT NOT NULL,
      related_data TEXT,
      status TEXT DEFAULT 'pending',
      handler_id TEXT,
      handler_name TEXT,
      handled_at DATETIME,
      old_value TEXT,
      new_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('数据库表初始化完成');
  });
}

module.exports = db;
