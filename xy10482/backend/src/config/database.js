const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到 SQLite 数据库');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS plots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        area REAL,
        crop_type TEXT,
        location TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS harvest_managers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        description TEXT,
        sort_order INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS loss_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS harvest_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plot_id INTEGER NOT NULL,
        manager_id INTEGER,
        harvest_date DATE NOT NULL,
        crop_type TEXT,
        estimated_quantity REAL,
        actual_quantity REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plot_id) REFERENCES plots(id),
        FOREIGN KEY (manager_id) REFERENCES harvest_managers(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS inventory_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_no TEXT NOT NULL UNIQUE,
        harvest_task_id INTEGER NOT NULL,
        grade_id INTEGER,
        quantity REAL NOT NULL,
        loss_quantity REAL DEFAULT 0,
        loss_reason_id INTEGER,
        unit TEXT DEFAULT 'kg',
        storage_location TEXT,
        status TEXT DEFAULT 'pending',
        quality_status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (harvest_task_id) REFERENCES harvest_tasks(id),
        FOREIGN KEY (grade_id) REFERENCES grades(id),
        FOREIGN KEY (loss_reason_id) REFERENCES loss_reasons(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS quality_inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        inspector TEXT,
        inspection_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        result TEXT NOT NULL,
        score REAL,
        defects TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES inventory_batches(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS grade_adjustment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        old_grade_id INTEGER,
        new_grade_id INTEGER,
        adjusted_by TEXT,
        adjustment_reason TEXT,
        adjusted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES inventory_batches(id),
        FOREIGN KEY (old_grade_id) REFERENCES grades(id),
        FOREIGN KEY (new_grade_id) REFERENCES grades(id)
      )
    `);

    console.log('数据库表初始化完成');
  });
}

module.exports = db;
