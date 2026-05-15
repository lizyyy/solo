const db = require('../config/database');

const initTables = () => {
  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS report_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      template_config TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1
    )`,
    
    `CREATE TABLE IF NOT EXISTS report_tasks (
      id TEXT PRIMARY KEY,
      template_id TEXT,
      task_name TEXT NOT NULL,
      parameters_snapshot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      total_steps INTEGER DEFAULT 100,
      started_at DATETIME,
      completed_at DATETIME,
      failed_at DATETIME,
      file_path TEXT,
      file_name TEXT,
      file_size INTEGER,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES report_templates(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS progress_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      progress INTEGER,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES report_tasks(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS failure_reasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      error_message TEXT NOT NULL,
      error_stack TEXT,
      error_code TEXT,
      retry_available BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES report_tasks(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS download_authorizations (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      authorized_by TEXT,
      authorized_until DATETIME NOT NULL,
      token TEXT NOT NULL UNIQUE,
      is_valid BOOLEAN DEFAULT 1,
      download_count INTEGER DEFAULT 0,
      max_downloads INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES report_tasks(id) ON DELETE CASCADE
    )`,
    
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON report_tasks(status)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_created ON report_tasks(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_events_task ON progress_events(task_id)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_token ON download_authorizations(token)`
  ];

  const executeStatements = (index) => {
    if (index >= sqlStatements.length) {
      console.log('所有表创建成功');
      insertSampleData();
      return;
    }

    db.run(sqlStatements[index], (err) => {
      if (err) {
        console.error(`表创建失败 (索引 ${index}):`, err.message);
      }
      executeStatements(index + 1);
    });
  };

  executeStatements(0);
};

const insertSampleData = () => {
  const sampleTemplates = [
    {
      id: 'tpl-001',
      name: '销售报表模板',
      description: '月度销售数据汇总报表',
      template_config: JSON.stringify({ type: 'sales', columns: ['date', 'region', 'amount', 'quantity'] })
    },
    {
      id: 'tpl-002',
      name: '用户分析模板',
      description: '用户行为分析报表',
      template_config: JSON.stringify({ type: 'user', columns: ['userId', 'loginCount', 'duration', 'lastActive'] })
    },
    {
      id: 'tpl-003',
      name: '库存监控模板',
      description: '库存预警和统计报表',
      template_config: JSON.stringify({ type: 'inventory', columns: ['sku', 'name', 'stock', 'threshold'] })
    }
  ];

  let completed = 0;
  sampleTemplates.forEach((tpl) => {
    db.run(
      `INSERT OR IGNORE INTO report_templates (id, name, description, template_config) VALUES (?, ?, ?, ?)`,
      [tpl.id, tpl.name, tpl.description, tpl.template_config],
      () => {
        completed++;
        if (completed === sampleTemplates.length) {
          console.log('示例模板数据初始化完成');
          db.close();
        }
      }
    );
  });
};

initTables();
