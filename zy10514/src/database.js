const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/deactivation.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS systems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      endpoint TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deactivation_tasks (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      employee_name TEXT,
      requested_by TEXT NOT NULL,
      systems TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      total_systems INTEGER DEFAULT 0,
      completed_systems INTEGER DEFAULT 0,
      failed_systems INTEGER DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      original_request TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_items (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      system_id TEXT NOT NULL,
      system_name TEXT NOT NULL,
      account_identifier TEXT,
      status TEXT DEFAULT 'PENDING',
      attempts INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      completed_at TEXT,
      error_code TEXT,
      error_message TEXT,
      raw_response TEXT,
      manually_corrected INTEGER DEFAULT 0,
      corrected_by TEXT,
      corrected_at TEXT,
      correction_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES deactivation_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      item_id TEXT,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_employee ON deactivation_tasks(employee_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON deactivation_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_items_task ON task_items(task_id);
    CREATE INDEX IF NOT EXISTS idx_items_status ON task_items(status);
  `);

  const systems = [
    { id: 'AD', name: '域账号', description: 'Windows Active Directory' },
    { id: 'EMAIL', name: '企业邮箱', description: '邮件系统' },
    { id: 'VPN', name: 'VPN', description: '远程访问VPN' },
    { id: 'CRM', name: 'CRM系统', description: '客户关系管理' },
    { id: 'HR', name: 'HR系统', description: '人力资源系统' },
    { id: 'FINANCE', name: '财务系统', description: '财务管理系统' },
    { id: 'GIT', name: '代码仓库', description: 'GitLab/GitHub' },
    { id: 'JIRA', name: 'JIRA', description: '项目管理' },
    { id: 'CONFLUENCE', name: 'Confluence', description: '文档系统' },
    { id: 'SLACK', name: 'Slack', description: '即时通讯' }
  ];

  const insertSystem = db.prepare('INSERT OR IGNORE INTO systems (id, name, description) VALUES (?, ?, ?)');
  systems.forEach(s => insertSystem.run(s.id, s.name, s.description));
}

module.exports = { db, initDatabase };
