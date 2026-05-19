const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/pump-room.db');
const db = new sqlite3.Database(dbPath);

const initDB = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'engineer', 'operator')),
          phone TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS inspections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          inspection_date DATE NOT NULL,
          inspector_name TEXT NOT NULL,
          pump_room_no TEXT NOT NULL,
          water_pressure REAL,
          water_level REAL,
          pump_status TEXT CHECK(pump_status IN ('正常', '故障', '维护中')),
          power_status TEXT CHECK(power_status IN ('正常', '断电', '异常')),
          temperature REAL,
          humidity REAL,
          remarks TEXT,
          status TEXT DEFAULT '待复核' CHECK(status IN ('待复核', '已通过', '需整改')),
          reviewed_by TEXT,
          reviewed_at DATETIME,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id),
          FOREIGN KEY (reviewed_by) REFERENCES users(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS alarms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alarm_time DATETIME NOT NULL,
          sensor_id TEXT NOT NULL,
          sensor_type TEXT NOT NULL,
          alarm_level TEXT CHECK(alarm_level IN ('低', '中', '高', '紧急')),
          alarm_type TEXT NOT NULL,
          alarm_value REAL,
          threshold_value REAL,
          pump_room_no TEXT NOT NULL,
          status TEXT DEFAULT '未处理' CHECK(status IN ('未处理', '处理中', '已解决', '误报')),
          handled_by TEXT,
          handled_at DATETIME,
          remarks TEXT,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (handled_by) REFERENCES users(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS work_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_no TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('巡检异常', '传感器告警', '设备报修', '其他')),
          source_id INTEGER,
          title TEXT NOT NULL,
          description TEXT,
          pump_room_no TEXT NOT NULL,
          priority TEXT CHECK(priority IN ('低', '中', '高', '紧急')),
          status TEXT DEFAULT '待派工' CHECK(status IN ('待派工', '已派工', '已到场', '处理中', '待复测', '已关闭')),
          reporter_name TEXT NOT NULL,
          reporter_phone TEXT,
          assigned_to TEXT,
          assigned_at DATETIME,
          arrived_at DATETIME,
          rechecked_at DATETIME,
          closed_at DATETIME,
          recheck_result TEXT,
          closing_remarks TEXT,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (assigned_to) REFERENCES users(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS bad_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_type TEXT NOT NULL CHECK(source_type IN ('inspection_csv', 'alarm_json')),
          file_name TEXT NOT NULL,
          row_number INTEGER,
          raw_data TEXT NOT NULL,
          error_reason TEXT NOT NULL,
          fix_suggestion TEXT,
          status TEXT DEFAULT '待处理' CHECK(status IN ('待处理', '已修正', '已忽略')),
          handled_by TEXT,
          handled_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (handled_by) REFERENCES users(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id INTEGER,
          details TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        if (row.count === 0) {
          const stmt = db.prepare("INSERT INTO users (id, name, role, phone) VALUES (?, ?, ?, ?)");
          stmt.run('admin001', '张主管', 'admin', '13800138001');
          stmt.run('eng001', '李工', 'engineer', '13800138002');
          stmt.run('op001', '王师傅', 'operator', '13800138003');
          stmt.finalize();
        }
        resolve();
      });
    });
  });
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = { db, initDB, runQuery, getQuery, allQuery };
