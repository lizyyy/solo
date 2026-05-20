const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('assistant', 'reviewer', 'admin', 'courier')),
  department TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_no TEXT UNIQUE NOT NULL,
  batch_hash TEXT NOT NULL,
  submitter_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'failed', 'manual_confirm', 'exported')),
  stamp_type TEXT NOT NULL CHECK(stamp_type IN ('authorized', 'attachment', 'resubmit')),
  total_materials INTEGER NOT NULL DEFAULT 0,
  error_details TEXT,
  exported_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submitter_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  material_index INTEGER NOT NULL,
  contract_no TEXT,
  contract_name TEXT,
  party_a TEXT,
  party_b TEXT,
  sign_date DATE,
  amount DECIMAL(15,2),
  page_count INTEGER,
  is_authorized BOOLEAN DEFAULT 0,
  raw_data TEXT NOT NULL,
  validation_errors TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'valid', 'invalid', 'stamped', 'rejected')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  UNIQUE(task_id, material_index)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  material_id INTEGER,
  operator_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (material_id) REFERENCES materials(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  permission_type TEXT NOT NULL CHECK(permission_type IN ('stamp_authorized', 'stamp_attachment', 'resubmit', 'export', 'courier_send')),
  granted_by INTEGER,
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (granted_by) REFERENCES users(id),
  UNIQUE(user_id, permission_type)
);

CREATE INDEX IF NOT EXISTS idx_tasks_batch_hash ON tasks(batch_hash);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_materials_contract_no ON materials(contract_no);
CREATE INDEX IF NOT EXISTS idx_audit_logs_task_id ON audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_material_id ON audit_logs(material_id);
`;

module.exports = SCHEMA;
