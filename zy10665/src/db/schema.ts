import { getDB } from './index';

export async function createTables(): Promise<void> {
  const db = await getDB();
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      parent_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      planned_date DATE NOT NULL,
      actual_date DATE,
      status TEXT NOT NULL DEFAULT 'in_progress',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (parent_id) REFERENCES milestones(id)
    );

    CREATE TABLE IF NOT EXISTS extension_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      milestone_id INTEGER NOT NULL,
      requested_by TEXT NOT NULL,
      reviewed_by TEXT,
      original_date DATE NOT NULL,
      requested_date DATE NOT NULL,
      reason TEXT NOT NULL,
      impact_scope TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      review_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (milestone_id) REFERENCES milestones(id)
    );

    CREATE TABLE IF NOT EXISTS history_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      performed_by TEXT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_parent ON milestones(parent_id);
    CREATE INDEX IF NOT EXISTS idx_extensions_milestone ON extension_requests(milestone_id);
    CREATE INDEX IF NOT EXISTS idx_history_entity ON history_logs(entity_type, entity_id);
  `);
}
