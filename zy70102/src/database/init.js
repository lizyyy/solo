const { getDb } = require('./connection');

const now = () => {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const initDatabase = () => {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS pump_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      current_status TEXT DEFAULT 'stopped',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS control_commands (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      action TEXT NOT NULL,
      source TEXT NOT NULL,
      operator TEXT,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS device_receipts (
      id TEXT PRIMARY KEY,
      command_id TEXT,
      device_id TEXT NOT NULL,
      reported_status TEXT NOT NULL,
      source TEXT NOT NULL,
      receipt_time TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interlock_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      rule_type TEXT NOT NULL,
      condition_device TEXT NOT NULL,
      condition_status TEXT NOT NULL,
      target_device TEXT NOT NULL,
      forbidden_action TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rule_execution_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER,
      command_id TEXT,
      device_id TEXT,
      action TEXT,
      condition_met INTEGER,
      decision TEXT,
      reason TEXT,
      executed_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alarms (
      id TEXT PRIMARY KEY,
      alarm_type TEXT NOT NULL,
      device_id TEXT,
      command_id TEXT,
      receipt_id TEXT,
      level TEXT DEFAULT 'warning',
      message TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      device_id TEXT,
      command_id TEXT,
      operator TEXT,
      action TEXT,
      detail TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const deviceCount = db.prepare('SELECT COUNT(*) as count FROM pump_devices').get().count;
  if (deviceCount === 0) {
    const insertDevice = db.prepare(
      'INSERT INTO pump_devices (id, name, current_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    const ts = now();
    insertDevice.run('PUMP-001', '一号循环水泵', 'stopped', ts, ts);
    insertDevice.run('PUMP-002', '二号循环水泵', 'stopped', ts, ts);
    insertDevice.run('PUMP-003', '三号备用泵', 'stopped', ts, ts);
  }

  const ruleCount = db.prepare('SELECT COUNT(*) as count FROM interlock_rules').get().count;
  if (ruleCount === 0) {
    const insertRule = db.prepare(`
      INSERT INTO interlock_rules (name, description, rule_type, condition_device, condition_status, target_device, forbidden_action, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const ts = now();
    insertRule.run(
      '双泵同时运行禁止',
      '当两台水泵同时运行时可能导致管网压力异常，禁止同时启动两台主泵',
      'mutual_exclusion',
      'PUMP-001',
      'running',
      'PUMP-002',
      'start',
      1,
      ts
    );
    insertRule.run(
      '双泵同时运行禁止-反向',
      '当两台水泵同时运行时可能导致管网压力异常，禁止同时启动两台主泵',
      'mutual_exclusion',
      'PUMP-002',
      'running',
      'PUMP-001',
      'start',
      1,
      ts
    );
    insertRule.run(
      '主泵运行时备用泵联锁',
      '至少有一台主泵运行时，才能启动备用泵作为冗余',
      'dependency',
      'PUMP-001',
      'stopped',
      'PUMP-003',
      'start',
      1,
      ts
    );
  }

  console.log('数据库初始化完成');
};

module.exports = { initDatabase };
