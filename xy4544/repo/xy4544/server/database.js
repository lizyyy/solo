const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/cabin_maintenance.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到 SQLite 数据库');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS cabins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cabin_number TEXT UNIQUE NOT NULL,
        deck TEXT NOT NULL,
        type TEXT DEFAULT '标准舱',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cabin_number TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        temperature REAL,
        humidity REAL,
        source TEXT DEFAULT 'CSV导入',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cabin_number) REFERENCES cabins (cabin_number)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS inspection_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cabin_number TEXT NOT NULL,
        inspection_date DATE NOT NULL,
        inspector TEXT,
        fan_coil_status TEXT,
        filter_status TEXT,
        condensate_pipe_status TEXT,
        temperature_setpoint REAL,
        actual_temperature REAL,
        actual_humidity REAL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cabin_number) REFERENCES cabins (cabin_number)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS alarm_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cabin_number TEXT NOT NULL,
        alarm_type TEXT NOT NULL,
        alarm_time DATETIME NOT NULL,
        alarm_level TEXT DEFAULT '普通',
        description TEXT,
        status TEXT DEFAULT '未确认',
        acknowledged_by TEXT,
        acknowledged_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cabin_number) REFERENCES cabins (cabin_number)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cabin_number TEXT NOT NULL,
        complaint_time DATETIME NOT NULL,
        complainant TEXT,
        type TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT '待处理',
        priority TEXT DEFAULT '普通',
        assigned_to TEXT,
        resolution TEXT,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cabin_number) REFERENCES cabins (cabin_number)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cabin_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cabin_number TEXT UNIQUE NOT NULL,
        risk_level TEXT DEFAULT '正常',
        risk_score INTEGER DEFAULT 0,
        is_false_alarm INTEGER DEFAULT 0,
        analysis_reason TEXT,
        evidence TEXT,
        maintenance_status TEXT DEFAULT '无需维修',
        maintenance_priority TEXT DEFAULT '低',
        manual_override INTEGER DEFAULT 0,
        override_reason TEXT,
        override_by TEXT,
        notes TEXT,
        analyzed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cabin_number) REFERENCES cabins (cabin_number)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS system_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_cabin ON sensor_data(cabin_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_timestamp ON sensor_data(timestamp)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_alarm_cabin ON alarm_data(cabin_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_complaint_cabin ON complaints(cabin_number)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_inspection_cabin ON inspection_data(cabin_number)`);

    console.log('数据库表初始化完成');
  });
}

module.exports = db;
