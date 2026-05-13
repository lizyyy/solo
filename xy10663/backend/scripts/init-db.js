const db = require('../src/database');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      phone TEXT,
      lab_item TEXT NOT NULL,
      lab_item_code TEXT,
      sampling_window TEXT NOT NULL,
      fasting_required BOOLEAN DEFAULT 0,
      fasting_hours INTEGER,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      report_status TEXT DEFAULT 'pending',
      reminder_sent BOOLEAN DEFAULT 0,
      reminder_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reschedule_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      old_appointment_date TEXT,
      new_appointment_date TEXT,
      old_appointment_time TEXT,
      new_appointment_time TEXT,
      old_sampling_window TEXT,
      new_sampling_window TEXT,
      old_lab_item TEXT,
      new_lab_item TEXT,
      old_fasting_required BOOLEAN,
      new_fasting_required BOOLEAN,
      reason TEXT,
      operator TEXT NOT NULL,
      is_abnormal BOOLEAN DEFAULT 0,
      abnormal_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS adjustment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      reason TEXT,
      operator TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT 'staff',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表初始化完成');
  db.close();
});
