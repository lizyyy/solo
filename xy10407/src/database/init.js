const fs = require('fs');
const path = require('path');
const { getAsync } = require('./index');
const config = require('../config');

const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function init() {
  const db = getAsync();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_code TEXT UNIQUE NOT NULL,
      team_name TEXT NOT NULL,
      devices TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_code TEXT UNIQUE NOT NULL,
      task_code TEXT NOT NULL,
      inspector_name TEXT NOT NULL,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      error_message TEXT,
      processed_readings INTEGER DEFAULT 0,
      valid_readings INTEGER DEFAULT 0,
      invalid_readings INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      device_code TEXT NOT NULL,
      reading_time TEXT NOT NULL,
      temperature REAL,
      pressure REAL,
      status TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reading_id INTEGER NOT NULL,
      anomaly_type TEXT NOT NULL,
      detail TEXT,
      confirmed INTEGER DEFAULT 0,
      confirmed_by TEXT,
      confirmed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_readings_device ON readings(device_code);
    CREATE INDEX IF NOT EXISTS idx_readings_time ON readings(reading_time);
  `);

  const taskCount = await db.get('SELECT COUNT(*) as count FROM tasks');

  if (taskCount.count === 0) {
    const tasks = [
      {
        task_code: 'TASK-2026-001',
        team_name: '一班',
        devices: JSON.stringify(['DEV-001', 'DEV-002', 'DEV-003']),
        due_date: '2026-12-31T23:59:59Z'
      },
      {
        task_code: 'TASK-2026-002',
        team_name: '二班',
        devices: JSON.stringify(['DEV-004', 'DEV-005']),
        due_date: '2026-12-31T23:59:59Z'
      },
      {
        task_code: 'TASK-2026-EXPIRED',
        team_name: '测试组',
        devices: JSON.stringify(['DEV-TEST-001']),
        due_date: '2025-01-01T23:59:59Z'
      }
    ];

    for (const task of tasks) {
      await db.run(
        'INSERT INTO tasks (task_code, team_name, devices, due_date) VALUES (?, ?, ?, ?)',
        task.task_code,
        task.team_name,
        task.devices,
        task.due_date
      );
    }

    console.log('数据库初始化完成，已插入示例任务数据。');
  } else {
    console.log('数据库已存在，跳过初始化。');
  }

  console.log('初始化完成。');
}

init().catch(err => {
  console.error('初始化失败:', err);
});
