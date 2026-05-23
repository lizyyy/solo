const db = require('../src/config/database');

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      route_name TEXT NOT NULL,
      route_code TEXT UNIQUE NOT NULL,
      driver_name TEXT,
      driver_phone TEXT,
      capacity INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      student_no TEXT UNIQUE NOT NULL,
      grade TEXT,
      class_name TEXT,
      parent_name TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      parent_wechat TEXT,
      route_id TEXT,
      default_stop_id TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id)
    );

    CREATE TABLE IF NOT EXISTS stops (
      id TEXT PRIMARY KEY,
      stop_name TEXT NOT NULL,
      stop_code TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      is_temporary INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS route_stops (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      stop_order INTEGER NOT NULL,
      arrival_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (stop_id) REFERENCES stops(id),
      UNIQUE(route_id, stop_id, stop_order)
    );

    CREATE TABLE IF NOT EXISTS detour_reasons (
      id TEXT PRIMARY KEY,
      reason_code TEXT UNIQUE NOT NULL,
      reason_name TEXT NOT NULL,
      description TEXT,
      severity TEXT DEFAULT 'normal',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS detour_plans (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      reason_id TEXT NOT NULL,
      plan_date DATE NOT NULL,
      start_time TEXT,
      end_time TEXT,
      status TEXT DEFAULT 'draft',
      estimated_delay INTEGER DEFAULT 0,
      operator TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(id),
      FOREIGN KEY (reason_id) REFERENCES detour_reasons(id)
    );

    CREATE TABLE IF NOT EXISTS detour_stop_replacements (
      id TEXT PRIMARY KEY,
      detour_plan_id TEXT NOT NULL,
      original_stop_id TEXT NOT NULL,
      temp_stop_id TEXT NOT NULL,
      new_arrival_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (detour_plan_id) REFERENCES detour_plans(id),
      FOREIGN KEY (original_stop_id) REFERENCES stops(id),
      FOREIGN KEY (temp_stop_id) REFERENCES stops(id)
    );

    CREATE TABLE IF NOT EXISTS detour_affected_students (
      id TEXT PRIMARY KEY,
      detour_plan_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      original_stop_id TEXT,
      new_stop_id TEXT,
      notified INTEGER DEFAULT 0,
      notified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (detour_plan_id) REFERENCES detour_plans(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      UNIQUE(detour_plan_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS parent_receipts (
      id TEXT PRIMARY KEY,
      detour_plan_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      confirm_type TEXT NOT NULL,
      confirm_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      message TEXT,
      is_late INTEGER DEFAULT 0,
      late_reason TEXT,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (detour_plan_id) REFERENCES detour_plans(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      UNIQUE(detour_plan_id, student_id, parent_phone)
    );

    CREATE TABLE IF NOT EXISTS status_transitions (
      id TEXT PRIMARY KEY,
      detour_plan_id TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      operator TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (detour_plan_id) REFERENCES detour_plans(id)
    );

    CREATE TABLE IF NOT EXISTS error_logs (
      id TEXT PRIMARY KEY,
      api_path TEXT,
      request_method TEXT,
      raw_input TEXT,
      error_message TEXT,
      processing_result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      detour_plan_id TEXT,
      operation_type TEXT NOT NULL,
      operator TEXT,
      before_data TEXT,
      after_data TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('数据库表初始化完成');
};

initTables();

if (require.main === module) {
  db.close();
}
