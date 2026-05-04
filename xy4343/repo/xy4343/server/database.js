const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

const dbPath = path.join(__dirname, '../data/museum.db');
const dataDir = path.join(__dirname, '../data');

// 确保数据目录存在
fs.ensureDirSync(dataDir);
fs.ensureDirSync(path.join(dataDir, 'levels'));
fs.ensureDirSync(path.join(dataDir, 'replays'));
fs.ensureDirSync(path.join(dataDir, 'exports'));

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('成功连接到 SQLite 数据库');
    initializeDatabase();
  }
});

function initializeDatabase() {
  // 创建关卡表
  db.run(`
    CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      floor_plan TEXT NOT NULL,
      checkpoints TEXT NOT NULL,
      time_limit INTEGER DEFAULT 120,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建巡查会话表
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      level_id INTEGER NOT NULL,
      player_name TEXT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      score INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 100,
      time_used INTEGER DEFAULT 0,
      checkpoints_visited TEXT DEFAULT '[]',
      checkpoints_missed TEXT DEFAULT '[]',
      distance_traveled REAL DEFAULT 0,
      optimal_distance REAL DEFAULT 0,
      detour_penalty INTEGER DEFAULT 0,
      missed_penalty INTEGER DEFAULT 0,
      over_time_penalty INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      FOREIGN KEY (level_id) REFERENCES levels (id)
    )
  `);

  // 创建回放记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS replays (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      replay_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions (id)
    )
  `);

  console.log('数据库表初始化完成');
}

module.exports = db;
