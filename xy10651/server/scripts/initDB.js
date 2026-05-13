const db = require('../database/db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS halls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      capacity INTEGER,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS screenings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hall_id INTEGER NOT NULL,
      movie_name TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT DEFAULT 'scheduled',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hall_id) REFERENCES halls(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      required_skills TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      skills TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS position_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position_id INTEGER NOT NULL,
      skill_name TEXT NOT NULL,
      skill_level INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (position_id) REFERENCES positions(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cleaning_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screening_id INTEGER NOT NULL,
      hall_id INTEGER NOT NULL,
      assigned_staff_id INTEGER,
      scheduled_time DATETIME NOT NULL,
      actual_start_time DATETIME,
      actual_end_time DATETIME,
      status TEXT DEFAULT 'pending',
      quality_score INTEGER,
      notes TEXT,
      old_values TEXT,
      new_values TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (screening_id) REFERENCES screenings(id),
      FOREIGN KEY (hall_id) REFERENCES halls(id),
      FOREIGN KEY (assigned_staff_id) REFERENCES staff(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS equipment_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hall_id INTEGER NOT NULL,
      cleaning_id INTEGER,
      inspector_id INTEGER,
      inspection_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      items TEXT,
      status TEXT DEFAULT 'pending',
      issues TEXT,
      resolution TEXT,
      resolved_by INTEGER,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hall_id) REFERENCES halls(id),
      FOREIGN KEY (cleaning_id) REFERENCES cleaning_schedules(id),
      FOREIGN KEY (inspector_id) REFERENCES staff(id),
      FOREIGN KEY (resolved_by) REFERENCES staff(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shift_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cleaning_id INTEGER,
      from_staff_id INTEGER NOT NULL,
      to_staff_id INTEGER NOT NULL,
      change_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT,
      approved_by INTEGER,
      status TEXT DEFAULT 'pending',
      callback_count INTEGER DEFAULT 0,
      last_callback_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cleaning_id) REFERENCES cleaning_schedules(id),
      FOREIGN KEY (from_staff_id) REFERENCES staff(id),
      FOREIGN KEY (to_staff_id) REFERENCES staff(id),
      FOREIGN KEY (approved_by) REFERENCES staff(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS uncovered_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hall_id INTEGER NOT NULL,
      screening_id INTEGER,
      position_id INTEGER NOT NULL,
      detected_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved BOOLEAN DEFAULT 0,
      resolved_by INTEGER,
      resolved_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hall_id) REFERENCES halls(id),
      FOREIGN KEY (screening_id) REFERENCES screenings(id),
      FOREIGN KEY (position_id) REFERENCES positions(id),
      FOREIGN KEY (resolved_by) REFERENCES staff(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      changed_by INTEGER,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (changed_by) REFERENCES staff(id)
    )
  `);

  console.log('数据库表创建完成！');
});

db.close();
