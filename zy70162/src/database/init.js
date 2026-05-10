const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { FILE_TASK_STATUS } = require('../config/constants');

const DB_PATH = path.join(__dirname, '../../data/app.db');
const dataDir = path.dirname(DB_PATH);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const createTables = async () => {
  console.log('创建 file_tasks 表...');
  await runQuery(`
    CREATE TABLE IF NOT EXISTS file_tasks (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_hash TEXT,
      uploader TEXT NOT NULL,
      business_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '${FILE_TASK_STATUS.PENDING}',
      scan_engine TEXT,
      scan_result TEXT,
      threat_type TEXT,
      threat_details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  console.log('创建索引...');
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_file_tasks_status ON file_tasks(status)`);
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_file_tasks_business_id ON file_tasks(business_id)`);
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_file_tasks_created_at ON file_tasks(created_at)`);

  console.log('创建 audit_logs 表...');
  await runQuery(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT,
      rule_applied TEXT,
      old_status TEXT,
      new_status TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id)`);
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`);

  console.log('创建 scan_rules 表...');
  await runQuery(`
    CREATE TABLE IF NOT EXISTS scan_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      conditions TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('创建 false_positive_reviews 表...');
  await runQuery(`
    CREATE TABLE IF NOT EXISTS false_positive_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      requester TEXT NOT NULL,
      reason TEXT NOT NULL,
      reviewer TEXT,
      review_comment TEXT,
      review_decision TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP
    )
  `);
  
  await runQuery(`CREATE INDEX IF NOT EXISTS idx_fp_reviews_task_id ON false_positive_reviews(task_id)`);
};

const seedRules = async () => {
  console.log('加载默认规则...');
  
  const rules = [
    {
      rule_name: 'default_pending_download',
      description: '待扫描文件不允许下载',
      rule_type: 'download',
      priority: 100,
      conditions: JSON.stringify({ status: FILE_TASK_STATUS.PENDING }),
      action: JSON.stringify({ permission: 'blocked', reason: '文件正在等待扫描，请稍后再试' })
    },
    {
      rule_name: 'default_scanning_download',
      description: '扫描中文件不允许下载',
      rule_type: 'download',
      priority: 90,
      conditions: JSON.stringify({ status: FILE_TASK_STATUS.SCANNING }),
      action: JSON.stringify({ permission: 'blocked', reason: '文件正在扫描中，请等待扫描完成' })
    },
    {
      rule_name: 'default_quarantined_download',
      description: '已隔离文件不允许下载',
      rule_type: 'download',
      priority: 80,
      conditions: JSON.stringify({ status: FILE_TASK_STATUS.QUARANTINED }),
      action: JSON.stringify({ permission: 'blocked', reason: '文件包含病毒，已被隔离，禁止下载' })
    },
    {
      rule_name: 'default_reviewing_download',
      description: '审核中文件需要特殊权限',
      rule_type: 'download',
      priority: 70,
      conditions: JSON.stringify({ status: FILE_TASK_STATUS.REVIEWING }),
      action: JSON.stringify({ permission: 'requires_review', reason: '文件正处于误报审核中，需管理员批准后下载' })
    },
    {
      rule_name: 'default_safe_download',
      description: '安全文件允许下载',
      rule_type: 'download',
      priority: 10,
      conditions: JSON.stringify({ status: FILE_TASK_STATUS.SAFE }),
      action: JSON.stringify({ permission: 'allowed', reason: '文件已通过病毒扫描，允许下载' })
    },
    {
      rule_name: 'default_unquarantined_download',
      description: '解除隔离文件允许下载',
      rule_type: 'download',
      priority: 10,
      conditions: JSON.stringify({ status: FILE_TASK_STATUS.UNQUARANTINED }),
      action: JSON.stringify({ permission: 'allowed', reason: '文件已被误报审核通过，允许下载' })
    }
  ];

  for (const rule of rules) {
    await runQuery(`
      INSERT OR IGNORE INTO scan_rules (rule_name, description, rule_type, priority, conditions, action)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      rule.rule_name,
      rule.description,
      rule.rule_type,
      rule.priority,
      rule.conditions,
      rule.action
    ]);
  }
  
  const rulesCount = await allQuery('SELECT COUNT(*) as count FROM scan_rules');
  console.log(`已加载 ${rulesCount[0].count} 条规则`);
};

const initDatabase = async () => {
  console.log('正在初始化数据库...');
  console.log('数据库路径:', DB_PATH);
  
  try {
    await runQuery('PRAGMA journal_mode = WAL;');
    await runQuery('PRAGMA foreign_keys = ON;');
    
    await createTables();
    console.log('数据库表创建完成');
    
    await seedRules();
    console.log('默认规则已加载');
    
    const tables = await allQuery(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    console.log('\n已创建的表:');
    tables.forEach(t => console.log('  -', t.name));
    
    console.log('\n数据库初始化完成');
    
    db.close((err) => {
      if (err) {
        console.error('关闭数据库连接失败:', err);
        process.exit(1);
      }
      process.exit(0);
    });
    
  } catch (err) {
    console.error('数据库初始化失败:', err);
    db.close();
    process.exit(1);
  }
};

initDatabase();
