const db = require('../config/database');

const initTables = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS index_rebuild_tasks (
      id TEXT PRIMARY KEY,
      index_name TEXT NOT NULL,
      data_source TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      pause_point TEXT,
      current_version TEXT,
      target_version TEXT NOT NULL,
      verify_query TEXT,
      verify_result TEXT,
      gray_traffic_percentage INTEGER DEFAULT 0,
      error_message TEXT,
      state_reason TEXT,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS task_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      operator TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES index_rebuild_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS switch_records (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      switch_type TEXT NOT NULL,
      from_version TEXT,
      to_version TEXT,
      traffic_percentage INTEGER,
      operator TEXT NOT NULL,
      rollback_reason TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES index_rebuild_tasks(id)
    );

    CREATE INDEX IF NOT EXISTS idx_task_stage ON index_rebuild_tasks(stage);
    CREATE INDEX IF NOT EXISTS idx_task_status ON index_rebuild_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_switch_records_task_id ON switch_records(task_id);
  `;

  db.exec(sql, (err) => {
    if (err) {
      console.error('创建表失败:', err.message);
    } else {
      console.log('数据库表初始化成功');
    }
    db.close();
  });
};

initTables();