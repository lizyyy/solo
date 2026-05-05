import { prepare, saveDatabase } from './database.js';

export const initSchema = () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      floor TEXT NOT NULL,
      shop_number TEXT NOT NULL,
      manager_name TEXT,
      manager_phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS construction_workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_card_number TEXT,
      phone TEXT,
      company TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      rule_type TEXT NOT NULL,
      config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      construction_type TEXT NOT NULL,
      blueprint_url TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS application_workers (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      FOREIGN KEY (application_id) REFERENCES applications(id),
      FOREIGN KEY (worker_id) REFERENCES construction_workers(id),
      UNIQUE(application_id, worker_id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS approval_actions (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      comment TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id),
      FOREIGN KEY (actor_id) REFERENCES users(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    `CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)`,
    `CREATE INDEX IF NOT EXISTS idx_applications_created_by ON applications(created_by)`,
    `CREATE INDEX IF NOT EXISTS idx_approval_actions_application ON approval_actions(application_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`,
  ];
  
  tables.forEach(sql => {
    try {
      prepare(sql).run();
    } catch (err) {
      console.error('Error executing SQL:', sql, err);
    }
  });
  
  console.log('Database schema initialized');
};
