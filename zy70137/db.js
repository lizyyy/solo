const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'frequency_control.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到推送频控数据库');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS frequency_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      scope TEXT NOT NULL,
      limit_count INTEGER NOT NULL,
      time_window INTEGER NOT NULL,
      unit TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scene TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      rule_id TEXT,
      status TEXT DEFAULT 'active',
      start_time TEXT,
      end_time TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_buckets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      bucket_date TEXT NOT NULL,
      activity_id TEXT,
      created_at TEXT,
      UNIQUE(user_id, bucket_date, activity_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      user_id TEXT,
      is_active INTEGER DEFAULT 1,
      last_used TEXT,
      created_at TEXT,
      UNIQUE(device_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS device_dedup (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      message_id TEXT,
      sent_at TEXT,
      UNIQUE(device_id, activity_id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      device_id TEXT,
      activity_id TEXT,
      content TEXT,
      status TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      check_result TEXT,
      failed_reason TEXT,
      created_at TEXT,
      sent_at TEXT,
      check_details TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS send_attempts (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT,
      device_id TEXT,
      activity_id TEXT,
      status TEXT NOT NULL,
      frequency_check TEXT,
      frequency_limit TEXT,
      check_result TEXT NOT NULL,
      check_time TEXT,
      details TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS failed_messages (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      user_id TEXT,
      device_id TEXT,
      activity_id TEXT,
      reason TEXT,
      retry_count INTEGER DEFAULT 0,
      next_retry_at TEXT,
      last_retry_at TEXT,
      created_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS statistics (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      activity_id TEXT,
      total_attempts INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      blocked_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      compensation_count INTEGER DEFAULT 0,
      UNIQUE(date, activity_id)
    )`);

    const defaultRules = [
      { name: '用户日限3条', type: 'user', scope: 'daily', limit_count: 3, time_window: 1, unit: 'day' },
      { name: '用户小时限1条', type: 'user', scope: 'hourly', limit_count: 1, time_window: 1, unit: 'hour' },
      { name: '设备日限2条', type: 'device', scope: 'daily', limit_count: 2, time_window: 1, unit: 'day' },
      { name: '场景活动高峰限5条/分钟', type: 'scene', scope: 'peak', limit_count: 5, time_window: 1, unit: 'minute' }
    ];

    const checkStmt = db.prepare('SELECT COUNT(*) as count FROM frequency_rules');
    checkStmt.get((err, row) => {
      if (err) return;
      if (row.count === 0) {
        const insertStmt = db.prepare(`INSERT INTO frequency_rules (id, name, type, scope, limit_count, time_window, unit, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        const now = new Date().toISOString();
        defaultRules.forEach(rule => {
          insertStmt.run(
            uuidv4(),
            rule.name,
            rule.type,
            rule.scope,
            rule.limit_count,
            rule.time_window,
            rule.unit,
            1,
            now,
            now
          );
        });
        insertStmt.finalize();
      }
    });
    checkStmt.finalize();
  });
}

module.exports = db;
