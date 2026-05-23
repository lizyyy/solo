const db = require('../database/db');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.serialize(() => {
  db.run(`DROP TABLE IF EXISTS appointment_status_history`);
  db.run(`DROP TABLE IF EXISTS exception_logs`);
  db.run(`DROP TABLE IF EXISTS health_declarations`);
  db.run(`DROP TABLE IF EXISTS appointments`);
  db.run(`DROP TABLE IF EXISTS time_slots`);
  db.run(`DROP TABLE IF EXISTS rooms`);
  db.run(`DROP TABLE IF EXISTS visitors`);
  db.run(`DROP TABLE IF EXISTS elders`);

  db.run(`
    CREATE TABLE elders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_card TEXT UNIQUE,
      room_number TEXT,
      bed_number TEXT,
      health_status TEXT,
      guardian_name TEXT,
      guardian_phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE visitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_card TEXT UNIQUE,
      phone TEXT NOT NULL,
      relation TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE rooms (
      id TEXT PRIMARY KEY,
      room_number TEXT NOT NULL UNIQUE,
      capacity INTEGER NOT NULL DEFAULT 2,
      floor INTEGER,
      area TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE time_slots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      max_visitors INTEGER NOT NULL DEFAULT 10,
      current_visitors INTEGER DEFAULT 0,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, start_time, end_time)
    )
  `);

  db.run(`
    CREATE TABLE health_declarations (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      has_fever INTEGER DEFAULT 0,
      has_cough INTEGER DEFAULT 0,
      has_contact_history INTEGER DEFAULT 0,
      temperature REAL,
      health_code_status TEXT DEFAULT 'green',
      declaration_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE appointments (
      id TEXT PRIMARY KEY,
      elder_id TEXT NOT NULL,
      visitor_id TEXT NOT NULL,
      time_slot_id TEXT NOT NULL,
      room_id TEXT NOT NULL,
      visitor_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      health_declaration_required INTEGER DEFAULT 1,
      notes TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (elder_id) REFERENCES elders(id) ON DELETE CASCADE,
      FOREIGN KEY (visitor_id) REFERENCES visitors(id) ON DELETE CASCADE,
      FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE appointment_status_history (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      change_reason TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE exception_logs (
      id TEXT PRIMARY KEY,
      request_type TEXT NOT NULL,
      request_data TEXT NOT NULL,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      handling_result TEXT NOT NULL,
      handled_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表创建完成');
});

db.close();
