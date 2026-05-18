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
      CREATE TABLE IF NOT EXISTS routes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        start_point TEXT NOT NULL,
        end_point TEXT NOT NULL,
        waypoints TEXT,
        distance REAL,
        altitude REAL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS drones (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        model TEXT,
        serial_number TEXT UNIQUE NOT NULL,
        max_flight_time INTEGER,
        max_altitude REAL,
        status TEXT DEFAULT 'idle',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS applicants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS no_fly_records (
        id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        drone_id TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        applicant_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        cancel_older_tasks INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (route_id) REFERENCES routes(id),
        FOREIGN KEY (drone_id) REFERENCES drones(id),
        FOREIGN KEY (applicant_id) REFERENCES applicants(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS no_fly_history (
        id TEXT PRIMARY KEY,
        record_id TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT NOT NULL,
        operator TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (record_id) REFERENCES no_fly_records(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS import_validation (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        row_data TEXT NOT NULL,
        is_valid INTEGER NOT NULL DEFAULT 0,
        errors TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('数据表初始化完成');
  });
}

module.exports = db;