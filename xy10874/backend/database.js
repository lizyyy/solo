const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'audit.db');

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
    db.run(`CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      author TEXT NOT NULL,
      description TEXT,
      package_url TEXT,
      min_platform_version TEXT NOT NULL,
      max_platform_version TEXT,
      status TEXT DEFAULT 'DRAFT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      plugin_id TEXT NOT NULL,
      permission_name TEXT NOT NULL,
      permission_level TEXT NOT NULL,
      description TEXT,
      risk_level TEXT DEFAULT 'LOW',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plugin_id) REFERENCES plugins(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS screenshots (
      id TEXT PRIMARY KEY,
      plugin_id TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      is_valid BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plugin_id) REFERENCES plugins(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS compatible_versions (
      id TEXT PRIMARY KEY,
      plugin_id TEXT NOT NULL,
      platform_version TEXT NOT NULL,
      is_tested BOOLEAN DEFAULT 0,
      test_result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plugin_id) REFERENCES plugins(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS audit_records (
      id TEXT PRIMARY KEY,
      plugin_id TEXT NOT NULL,
      auditor TEXT,
      status TEXT NOT NULL,
      reason TEXT,
      suggestions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plugin_id) REFERENCES plugins(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS release_records (
      id TEXT PRIMARY KEY,
      plugin_id TEXT NOT NULL,
      version TEXT NOT NULL,
      release_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_rollback BOOLEAN DEFAULT 0,
      rollback_time DATETIME,
      rollback_reason TEXT,
      operator TEXT NOT NULL,
      FOREIGN KEY (plugin_id) REFERENCES plugins(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS validation_rules (
      id TEXT PRIMARY KEY,
      rule_name TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT 1
    )`);

    insertDefaultRules();
  });
}

function insertDefaultRules() {
  const rules = [
    { id: 'rule_001', rule_name: '最小截图数量', rule_type: 'MATERIAL', description: '至少需要2张截图' },
    { id: 'rule_002', rule_name: '高危权限审核', rule_type: 'PERMISSION', description: '包含HIGH风险权限需要人工审核' },
    { id: 'rule_003', rule_name: '版本号格式', rule_type: 'VERSION', description: '版本号必须符合语义化版本规范' },
    { id: 'rule_004', rule_name: '平台版本兼容', rule_type: 'COMPATIBILITY', description: '需要兼容至少一个稳定平台版本' },
  ];

  rules.forEach(rule => {
    db.get('SELECT id FROM validation_rules WHERE id = ?', [rule.id], (err, row) => {
      if (!row) {
        db.run('INSERT INTO validation_rules (id, rule_name, rule_type, description) VALUES (?, ?, ?, ?)',
          [rule.id, rule.rule_name, rule.rule_type, rule.description]);
      }
    });
  });
}

module.exports = db;
