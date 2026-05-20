const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/equipment.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        batch_type TEXT NOT NULL,
        source_file TEXT,
        total_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        remark TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS inspection_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER,
        record_no TEXT UNIQUE NOT NULL,
        cable_car_no TEXT NOT NULL,
        inspection_item TEXT NOT NULL,
        inspection_date DATE NOT NULL,
        inspector TEXT,
        inspection_result TEXT,
        is_key_item INTEGER DEFAULT 0,
        trial_run_hours REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        approval_status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER,
        record_id INTEGER,
        cable_car_no TEXT NOT NULL,
        sensor_type TEXT NOT NULL,
        sensor_value REAL,
        sensor_unit TEXT,
        collect_time DATETIME NOT NULL,
        is_normal INTEGER DEFAULT 1,
        threshold_min REAL,
        threshold_max REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (record_id) REFERENCES inspection_records(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS approval_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER,
        record_id INTEGER,
        form_no TEXT UNIQUE NOT NULL,
        approver TEXT,
        approve_time DATETIME,
        approve_result TEXT,
        approve_remark TEXT,
        is_signed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id),
        FOREIGN KEY (record_id) REFERENCES inspection_records(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        operation_type TEXT NOT NULL,
        operator TEXT NOT NULL,
        operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        reason TEXT,
        remark TEXT,
        source_batch_id INTEGER,
        previous_status TEXT,
        new_status TEXT,
        FOREIGN KEY (record_id) REFERENCES inspection_records(id),
        FOREIGN KEY (source_batch_id) REFERENCES batches(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS exception_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        exception_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        handler TEXT NOT NULL,
        handle_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        handle_result TEXT,
        is_resolved INTEGER DEFAULT 0,
        FOREIGN KEY (record_id) REFERENCES inspection_records(id)
      )
    `);

    console.log('数据表初始化完成');
  });
}

module.exports = db;
