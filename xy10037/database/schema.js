const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

const TABLES = {
  tasks: `
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      task_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      customer_account TEXT,
      problem_type TEXT NOT NULL,
      description TEXT,
      promised_action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'normal',
      assignee TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      due_at INTEGER,
      completed_at INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  
  task_transitions: `
    CREATE TABLE IF NOT EXISTS task_transitions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `,
  
  audit_logs: `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      target_id TEXT,
      operator TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      request_body TEXT,
      response_body TEXT,
      created_at INTEGER NOT NULL
    )
  `,
  
  idempotent_requests: `
    CREATE TABLE IF NOT EXISTS idempotent_requests (
      request_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      target_id TEXT,
      response TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `,
  
  failed_tasks: `
    CREATE TABLE IF NOT EXISTS failed_tasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      error_message TEXT,
      stack_trace TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER,
      last_retry_at INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `,
  
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )
  `
};

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, is_deleted)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee, is_deleted)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_transitions_task_id ON task_transitions(task_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_logs_target ON audit_logs(target_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_logs_operator ON audit_logs(operator, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_failed_task ON failed_tasks(task_id)',
  'CREATE INDEX IF NOT EXISTS idx_failed_next_retry ON failed_tasks(next_retry_at, status)'
];

module.exports = {
  TASK_STATUS,
  TABLES,
  INDEXES
};
