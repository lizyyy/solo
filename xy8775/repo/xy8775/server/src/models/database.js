const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/scheduling.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 活动日期表
  db.run(`
    CREATE TABLE IF NOT EXISTS event_dates (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 岗位表
  db.run(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      required_skills TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 日期-岗位需求表
  db.run(`
    CREATE TABLE IF NOT EXISTS date_position_requirements (
      id TEXT PRIMARY KEY,
      date_id TEXT NOT NULL,
      position_id TEXT NOT NULL,
      required_count INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (date_id) REFERENCES event_dates (id) ON DELETE CASCADE,
      FOREIGN KEY (position_id) REFERENCES positions (id) ON DELETE CASCADE,
      UNIQUE (date_id, position_id)
    )
  `);

  // 技能标签表
  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 志愿者表
  db.run(`
    CREATE TABLE IF NOT EXISTS volunteers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      max_daily_shifts INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 志愿者-技能关联表
  db.run(`
    CREATE TABLE IF NOT EXISTS volunteer_skills (
      volunteer_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      PRIMARY KEY (volunteer_id, skill_id),
      FOREIGN KEY (volunteer_id) REFERENCES volunteers (id) ON DELETE CASCADE,
      FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE
    )
  `);

  // 志愿者-可用日期关联表
  db.run(`
    CREATE TABLE IF NOT EXISTS volunteer_available_dates (
      volunteer_id TEXT NOT NULL,
      date_id TEXT NOT NULL,
      PRIMARY KEY (volunteer_id, date_id),
      FOREIGN KEY (volunteer_id) REFERENCES volunteers (id) ON DELETE CASCADE,
      FOREIGN KEY (date_id) REFERENCES event_dates (id) ON DELETE CASCADE
    )
  `);

  // 排班记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      date_id TEXT NOT NULL,
      position_id TEXT NOT NULL,
      volunteer_id TEXT NOT NULL,
      is_draft BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (date_id) REFERENCES event_dates (id) ON DELETE CASCADE,
      FOREIGN KEY (position_id) REFERENCES positions (id) ON DELETE CASCADE,
      FOREIGN KEY (volunteer_id) REFERENCES volunteers (id) ON DELETE CASCADE,
      UNIQUE (date_id, position_id, volunteer_id)
    )
  `);

  // 创建索引以提高查询性能
  db.run('CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules (date_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_schedules_position ON schedules (position_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_schedules_volunteer ON schedules (volunteer_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_volunteer_skills_volunteer ON volunteer_skills (volunteer_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_volunteer_available_dates_volunteer ON volunteer_available_dates (volunteer_id)');
});

module.exports = db;
