const db = require('../src/config/database');

const initTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS escorts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        department TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        escort_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        shift_type TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (escort_id) REFERENCES escorts(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_no TEXT UNIQUE NOT NULL,
        patient_name TEXT NOT NULL,
        patient_id TEXT,
        phone TEXT,
        department TEXT,
        exam_type TEXT,
        appointment_date TEXT NOT NULL,
        appointment_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_no TEXT UNIQUE NOT NULL,
        appointment_id INTEGER NOT NULL,
        escort_id INTEGER,
        status TEXT DEFAULT 'pending',
        assigned_at DATETIME,
        accepted_at DATETIME,
        started_at DATETIME,
        completed_at DATETIME,
        cancelled_at DATETIME,
        cancel_reason TEXT,
        is_inserted BOOLEAN DEFAULT 0,
        inserted_by TEXT,
        inserted_at DATETIME,
        is_overdue BOOLEAN DEFAULT 0,
        overdue_reason TEXT,
        estimated_duration INTEGER DEFAULT 30,
        actual_duration INTEGER,
        waiting_time INTEGER,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id),
        FOREIGN KEY (escort_id) REFERENCES escorts(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        operator TEXT,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS import_errors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        import_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        row_number INTEGER,
        original_data TEXT,
        error_message TEXT,
        suggestion TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      console.log('数据库表初始化完成');
      resolve();
    });
  });
};

initTables().then(() => {
  db.close();
  process.exit(0);
}).catch((err) => {
  console.error('初始化失败:', err);
  db.close();
  process.exit(1);
});
