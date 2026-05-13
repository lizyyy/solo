const db = require('../config/database');

const initDatabase = () => {
  db.serialize(() => {
    
    db.run(`DROP TABLE IF EXISTS work_hour_records`);
    db.run(`DROP TABLE IF EXISTS substitute_records`);
    db.run(`DROP TABLE IF EXISTS leave_records`);
    db.run(`DROP TABLE IF EXISTS schedules`);
    db.run(`DROP TABLE IF EXISTS ward_demands`);
    db.run(`DROP TABLE IF EXISTS caregivers`);
    db.run(`DROP TABLE IF EXISTS time_lines`);
    db.run(`DROP TABLE IF EXISTS audit_logs`);
    db.run(`DROP TABLE IF EXISTS wards`);

    db.run(`CREATE TABLE wards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT,
      level INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE caregivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      id_card TEXT,
      qualifications TEXT,
      skill_level INTEGER DEFAULT 1,
      max_consecutive_hours INTEGER DEFAULT 24,
      max_daily_hours INTEGER DEFAULT 12,
      max_weekly_hours INTEGER DEFAULT 60,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE ward_demands (
      id TEXT PRIMARY KEY,
      ward_id TEXT NOT NULL,
      date DATE NOT NULL,
      shift_type TEXT NOT NULL,
      required_count INTEGER DEFAULT 1,
      required_qualifications TEXT,
      min_skill_level INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ward_id) REFERENCES wards(id)
    )`);

    db.run(`CREATE TABLE schedules (
      id TEXT PRIMARY KEY,
      ward_demand_id TEXT NOT NULL,
      caregiver_id TEXT NOT NULL,
      date DATE NOT NULL,
      shift_type TEXT NOT NULL,
      start_time DATETIME,
      end_time DATETIME,
      actual_hours REAL DEFAULT 0,
      status TEXT DEFAULT 'scheduled',
      remarks TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ward_demand_id) REFERENCES ward_demands(id),
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id)
    )`);

    db.run(`CREATE TABLE leave_records (
      id TEXT PRIMARY KEY,
      caregiver_id TEXT NOT NULL,
      schedule_id TEXT,
      leave_type TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    )`);

    db.run(`CREATE TABLE substitute_records (
      id TEXT PRIMARY KEY,
      original_schedule_id TEXT NOT NULL,
      substitute_caregiver_id TEXT NOT NULL,
      leave_id TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at DATETIME,
      remarks TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (original_schedule_id) REFERENCES schedules(id),
      FOREIGN KEY (substitute_caregiver_id) REFERENCES caregivers(id),
      FOREIGN KEY (leave_id) REFERENCES leave_records(id)
    )`);

    db.run(`CREATE TABLE work_hour_records (
      id TEXT PRIMARY KEY,
      caregiver_id TEXT NOT NULL,
      schedule_id TEXT,
      date DATE NOT NULL,
      hours REAL NOT NULL,
      hour_type TEXT NOT NULL,
      related_record_id TEXT,
      remarks TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id),
      FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    )`);

    db.run(`CREATE TABLE time_lines (
      id TEXT PRIMARY KEY,
      related_type TEXT NOT NULL,
      related_id TEXT NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      description TEXT NOT NULL,
      operator TEXT,
      operation_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      old_data TEXT,
      new_data TEXT,
      operator TEXT,
      operation_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('数据库表创建完成');
  });
};

initDatabase();