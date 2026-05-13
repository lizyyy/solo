const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/restaurant.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS table_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number TEXT NOT NULL UNIQUE,
      type_id INTEGER NOT NULL,
      status TEXT DEFAULT 'available',
      current_queue_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (type_id) REFERENCES table_types(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS queue_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_number TEXT NOT NULL UNIQUE,
      party_size INTEGER NOT NULL,
      customer_name TEXT,
      phone TEXT,
      table_type_id INTEGER NOT NULL,
      status TEXT DEFAULT 'waiting',
      assigned_table_id INTEGER,
      checkin_time TEXT,
      call_time TEXT,
      seating_time TEXT,
      completed_time TEXT,
      cancelled_time TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_type_id) REFERENCES table_types(id),
      FOREIGN KEY (assigned_table_id) REFERENCES tables(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS merge_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_id_1 INTEGER NOT NULL,
      queue_id_2 INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      merged_table_id INTEGER,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (queue_id_1) REFERENCES queue_numbers(id),
      FOREIGN KEY (queue_id_2) REFERENCES queue_numbers(id),
      FOREIGN KEY (merged_table_id) REFERENCES tables(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS skip_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_id INTEGER NOT NULL,
      skip_count INTEGER DEFAULT 1,
      skip_reason TEXT,
      skipped_by TEXT,
      skipped_at TEXT DEFAULT CURRENT_TIMESTAMP,
      restored_at TEXT,
      restored_by TEXT,
      status TEXT DEFAULT 'skipped',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (queue_id) REFERENCES queue_numbers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      target_table TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      operation_time TEXT DEFAULT CURRENT_TIMESTAMP,
      remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT,
      party_size INTEGER NOT NULL,
      table_type_id INTEGER NOT NULL,
      reserve_time TEXT NOT NULL,
      table_id INTEGER,
      status TEXT DEFAULT 'pending',
      lock_expire_time TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_type_id) REFERENCES table_types(id),
      FOREIGN KEY (table_id) REFERENCES tables(id)
    )
  `);

  console.log('数据库表创建完成');
});

db.close();
