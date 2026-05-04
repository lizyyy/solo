const Database = require('better-sqlite3');
const path = require('path');

class LaserCutterDB {
  constructor(dbPath = './laser_cutter.db') {
    this.db = new Database(dbPath);
    this.initTables();
  }

  initTables() {
    // 用户表（包含培训状态）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        is_trained BOOLEAN DEFAULT 0,
        training_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 预约表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        machine_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        material_type TEXT,
        material_thickness REAL,
        power REAL,
        speed REAL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);

    // 材料安全表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_type TEXT UNIQUE NOT NULL,
        material_name TEXT NOT NULL,
        min_thickness REAL,
        max_thickness REAL,
        recommended_power_min REAL,
        recommended_power_max REAL,
        recommended_speed_min REAL,
        recommended_speed_max REAL,
        is_forbidden BOOLEAN DEFAULT 0,
        safety_notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 维护时段表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS maintenance_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slot_id TEXT UNIQUE NOT NULL,
        machine_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        maintenance_type TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 开机记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operation_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id TEXT UNIQUE NOT NULL,
        machine_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        actual_power REAL,
        actual_speed REAL,
        material_used TEXT,
        material_thickness_actual REAL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )
    `);

    // 违规记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS violations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        violation_id TEXT UNIQUE NOT NULL,
        violation_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        related_record_type TEXT,
        related_record_id TEXT,
        user_id TEXT,
        machine_id TEXT,
        timestamp TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        review_notes TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 复核记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        review_id TEXT UNIQUE NOT NULL,
        violation_id TEXT NOT NULL,
        original_violation_type TEXT,
        new_violation_type TEXT,
        original_severity TEXT,
        new_severity TEXT,
        original_status TEXT,
        new_status TEXT,
        review_notes TEXT,
        reviewed_by TEXT,
        reviewed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (violation_id) REFERENCES violations(violation_id)
      )
    `);

    // 审计日志表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id TEXT UNIQUE NOT NULL,
        action TEXT NOT NULL,
        table_name TEXT,
        record_id TEXT,
        old_values TEXT,
        new_values TEXT,
        performed_by TEXT,
        performed_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引以提高查询性能
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_time ON appointments(start_time, end_time)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_maintenance_time ON maintenance_slots(start_time, end_time)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_operations_time ON operation_records(start_time, end_time)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_violations_user ON violations(user_id)`);
  }

  // 通用方法
  run(sql, params = []) {
    return this.db.run(sql, params);
  }

  get(sql, params = []) {
    return this.db.get(sql, params);
  }

  all(sql, params = []) {
    return this.db.all(sql, params);
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  transaction(fn) {
    return this.db.transaction(fn);
  }

  close() {
    this.db.close();
  }
}

module.exports = LaserCutterDB;
