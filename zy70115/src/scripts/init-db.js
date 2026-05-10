const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../kitchen.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('无法打开数据库:', err.message);
    return;
  }
  console.log('开始初始化数据库...');

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      student_count INTEGER DEFAULT 0,
      teacher_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS delivery_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      stop_order TEXT,
      max_capacity INTEGER DEFAULT 1000,
      driver_name TEXT,
      vehicle_number TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS route_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      school_id INTEGER NOT NULL,
      order_no INTEGER NOT NULL,
      estimated_arrival TEXT,
      FOREIGN KEY (route_id) REFERENCES delivery_routes(id),
      FOREIGN KEY (school_id) REFERENCES schools(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS allergen_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER,
      class_id INTEGER,
      allergen_type TEXT NOT NULL,
      description TEXT,
      affected_student_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_date TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      total_meals INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS meal_plan_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      school_id INTEGER NOT NULL,
      route_id INTEGER,
      meal_count INTEGER DEFAULT 0,
      allergen_checked INTEGER DEFAULT 0,
      route_checked INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (school_id) REFERENCES schools(id),
      FOREIGN KEY (route_id) REFERENCES delivery_routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS student_count_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      meal_plan_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      old_count INTEGER,
      new_count INTEGER,
      reason TEXT,
      created_by TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS route_loads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id INTEGER NOT NULL,
      route_id INTEGER NOT NULL,
      total_meals INTEGER DEFAULT 0,
      loaded_by TEXT,
      load_time TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id),
      FOREIGN KEY (route_id) REFERENCES delivery_routes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS route_load_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_load_id INTEGER NOT NULL,
      meal_plan_item_id INTEGER NOT NULL,
      loaded_count INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_load_id) REFERENCES route_loads(id),
      FOREIGN KEY (meal_plan_item_id) REFERENCES meal_plan_items(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS delivery_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_load_id INTEGER NOT NULL,
      school_id INTEGER NOT NULL,
      received_by TEXT,
      received_count INTEGER,
      condition TEXT,
      signature TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_load_id) REFERENCES route_loads(id),
      FOREIGN KEY (school_id) REFERENCES schools(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS exception_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      exception_type TEXT NOT NULL,
      description TEXT NOT NULL,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      status TEXT DEFAULT 'open',
      reported_by TEXT,
      resolved_by TEXT,
      resolved_at TEXT,
      resolution TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS process_flow_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_plan_id INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      status TEXT NOT NULL,
      result_message TEXT,
      operator TEXT,
      checkpoint_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (meal_plan_id) REFERENCES meal_plans(id)
    )`);

    console.log('数据库表初始化完成');
  });

  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('数据库连接已关闭');
  });
});
