const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let db;

function initDatabase(app) {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'piano_room.db');
  db = new Database(dbPath);
  createTables();
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_hours INTEGER NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      package_id INTEGER,
      remaining_hours REAL DEFAULT 0,
      used_hours REAL DEFAULT 0,
      join_date TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id)
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT,
      equipment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      scheduled_start TEXT NOT NULL,
      scheduled_end TEXT NOT NULL,
      actual_start TEXT,
      actual_end TEXT,
      status TEXT DEFAULT 'pending',
      is_extended INTEGER DEFAULT 0,
      original_reservation_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      event_time TEXT NOT NULL,
      reservation_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      reservation_id INTEGER NOT NULL,
      scheduled_hours REAL NOT NULL,
      actual_hours REAL NOT NULL,
      package_deduction REAL NOT NULL,
      cash_payment REAL DEFAULT 0,
      status TEXT NOT NULL,
      error_message TEXT,
      verification_data TEXT,
      settlement_time TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    );

    CREATE TABLE IF NOT EXISTS settlement_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      settlement_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id)
    );
  `);

  initSeedData();
}

function initSeedData() {
  const count = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
  if (count.count === 0) {
    db.exec(`
      INSERT INTO packages (name, total_hours, price, description) VALUES
      ('体验套餐', 5, 200, '5小时体验'),
      ('标准套餐', 50, 1800, '50小时标准'),
      ('高级套餐', 100, 3200, '100小时高级');

      INSERT INTO members (name, phone, email, package_id, remaining_hours, used_hours) VALUES
      ('张三', '13800138001', 'zhangsan@example.com', 2, 45, 5),
      ('李四', '13800138002', 'lisi@example.com', 3, 90, 10),
      ('王五', '13800138003', 'wangwu@example.com', 1, 3, 2);

      INSERT INTO rooms (name, location, equipment) VALUES
      ('钢琴房A', '1楼左侧', '雅马哈三角钢琴'),
      ('钢琴房B', '1楼右侧', '珠江立式钢琴'),
      ('钢琴房C', '2楼左侧', '斯坦威三角钢琴');
    `);
  }
}

function getDb() {
  return db;
}

module.exports = { initDatabase, getDb };
