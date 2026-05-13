import db, { run } from '../database';

const createTables = async () => {
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS instrument_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        instruments TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS recovery_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recovery_no TEXT UNIQUE NOT NULL,
        package_id INTEGER NOT NULL,
        department TEXT NOT NULL,
        recovery_time TEXT NOT NULL,
        receiver TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (package_id) REFERENCES instrument_packages(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS cleaning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cleaning_no TEXT UNIQUE NOT NULL,
        recovery_id INTEGER NOT NULL,
        cleaner TEXT NOT NULL,
        cleaning_method TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        result TEXT DEFAULT 'pending',
        temperature REAL,
        duration INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (recovery_id) REFERENCES recovery_records(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS sterilization_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT UNIQUE NOT NULL,
        cleaning_ids TEXT NOT NULL,
        sterilizer TEXT NOT NULL,
        sterilization_method TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        temperature REAL,
        pressure REAL,
        duration INTEGER,
        result TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS failure_isolations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isolation_no TEXT UNIQUE NOT NULL,
        source_type TEXT NOT NULL,
        source_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        handler TEXT NOT NULL,
        isolation_time TEXT NOT NULL,
        status TEXT DEFAULT 'isolated',
        corrective_action TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS department_distributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distribution_no TEXT UNIQUE NOT NULL,
        package_id INTEGER NOT NULL,
        department TEXT NOT NULL,
        distributor TEXT NOT NULL,
        distribution_time TEXT NOT NULL,
        receiver TEXT,
        status TEXT DEFAULT 'distributed',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (package_id) REFERENCES instrument_packages(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS modification_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        modified_by TEXT NOT NULL,
        modified_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    console.log('数据库表创建成功');
    db.close();
  } catch (error) {
    console.error('数据库表创建失败:', error);
    db.close();
  }
};

createTables();
