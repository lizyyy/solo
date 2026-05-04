const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'medication.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到 SQLite 数据库');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 老人表
    db.run(`
      CREATE TABLE IF NOT EXISTS elderly (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER,
        room TEXT,
        phone TEXT,
        emergency_contact TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 药品表
    db.run(`
      CREATE TABLE IF NOT EXISTS medicines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        specification TEXT,
        manufacturer TEXT,
        category TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 服药计划表
    db.run(`
      CREATE TABLE IF NOT EXISTS medication_plans (
        id TEXT PRIMARY KEY,
        elderly_id TEXT NOT NULL,
        medicine_id TEXT NOT NULL,
        dosage TEXT NOT NULL,
        time TEXT NOT NULL,
        frequency TEXT DEFAULT '每天',
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (elderly_id) REFERENCES elderly (id),
        FOREIGN KEY (medicine_id) REFERENCES medicines (id)
      )
    `);

    // 库存表
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        medicine_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        threshold INTEGER NOT NULL DEFAULT 10,
        unit TEXT DEFAULT '盒',
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (medicine_id) REFERENCES medicines (id)
      )
    `);

    // 志愿者交接记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS handover_records (
        id TEXT PRIMARY KEY,
        medicine_id TEXT NOT NULL,
        from_volunteer TEXT NOT NULL,
        to_volunteer TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        handover_time TEXT DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (medicine_id) REFERENCES medicines (id)
      )
    `);

    // 服药提醒记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS reminder_records (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        elderly_id TEXT NOT NULL,
        medicine_id TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        actual_time TEXT,
        status TEXT DEFAULT 'pending',
        volunteer_name TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES medication_plans (id),
        FOREIGN KEY (elderly_id) REFERENCES elderly (id),
        FOREIGN KEY (medicine_id) REFERENCES medicines (id)
      )
    `);

    // 补药任务表
    db.run(`
      CREATE TABLE IF NOT EXISTS replenish_tasks (
        id TEXT PRIMARY KEY,
        medicine_id TEXT NOT NULL,
        current_quantity INTEGER NOT NULL,
        required_quantity INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        assigned_to TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        notes TEXT,
        FOREIGN KEY (medicine_id) REFERENCES medicines (id)
      )
    `);

    console.log('数据库表初始化完成');
  });
}

module.exports = db;
