const db = require('../db');

console.log('开始初始化数据库...');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    patient_name TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    department TEXT NOT NULL,
    inspection_type TEXT NOT NULL,
    estimated_time INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_to TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    accepted_at INTEGER,
    started_at INTEGER,
    completed_at INTEGER,
    cancelled_at INTEGER,
    cancelled_by TEXT,
    cancel_reason TEXT,
    queue_position INTEGER,
    is_overtime BOOLEAN DEFAULT 0,
    overtime_reason TEXT,
    actual_duration INTEGER,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    action TEXT NOT NULL,
    operator TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    details TEXT,
    error_type TEXT,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_task_id ON audit_logs(task_id);
  CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_logs(operator);
  CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_error_type ON audit_logs(error_type);
`);

console.log('数据库初始化完成！');
console.log('表结构:');
console.log('- tasks: 陪检任务表');
console.log('- audit_logs: 操作审计表');

process.exit(0);
