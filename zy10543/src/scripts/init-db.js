const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/risk-registry.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('开始初始化数据库...');

  db.run(`
    CREATE TABLE IF NOT EXISTS risks (
      id TEXT PRIMARY KEY,
      project_code TEXT NOT NULL,
      risk_description TEXT NOT NULL,
      owner TEXT NOT NULL,
      action_plan TEXT,
      close_condition TEXT,
      status TEXT NOT NULL DEFAULT 'registered',
      report TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      closed_at DATETIME,
      closed_by TEXT,
      close_evidence TEXT,
      version INTEGER NOT NULL DEFAULT 1
    )
  `, (err) => {
    if (err) console.error('创建 risks 表失败:', err);
    else console.log('✓ risks 表创建成功');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS risk_status_history (
      id TEXT PRIMARY KEY,
      risk_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      action TEXT NOT NULL,
      action_by TEXT NOT NULL,
      action_at DATETIME NOT NULL,
      comment TEXT,
      evidence TEXT,
      FOREIGN KEY (risk_id) REFERENCES risks(id)
    )
  `, (err) => {
    if (err) console.error('创建 risk_status_history 表失败:', err);
    else console.log('✓ risk_status_history 表创建成功');
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS failed_operations (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      risk_id TEXT,
      original_input TEXT NOT NULL,
      error_message TEXT NOT NULL,
      processing_basis TEXT,
      final_conclusion TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      resolved_at DATETIME,
      resolved_by TEXT,
      resolution_notes TEXT
    )
  `, (err) => {
    if (err) console.error('创建 failed_operations 表失败:', err);
    else console.log('✓ failed_operations 表创建成功');
  });

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_risks_project_code ON risks(project_code)
  `);
  
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status)
  `);
  
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_risks_owner ON risks(owner)
  `);
  
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_risk_status_history_risk_id ON risk_status_history(risk_id)
  `);
  
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_failed_operations_risk_id ON failed_operations(risk_id)
  `);

  console.log('数据库初始化完成！');
});

db.close();
