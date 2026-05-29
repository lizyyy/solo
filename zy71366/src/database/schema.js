const createTables = `
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  scene_code TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, name)
);

CREATE TABLE IF NOT EXISTS lut_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL,
  scene_id INTEGER,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_extension TEXT NOT NULL,
  colorist TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  is_archive BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (scene_id) REFERENCES scenes(id),
  UNIQUE(project_id, name, version)
);

CREATE TABLE IF NOT EXISTS lut_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lut_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lut_id) REFERENCES lut_records(id),
  UNIQUE(lut_id, tag)
);

CREATE TABLE IF NOT EXISTS version_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lut_uuid TEXT NOT NULL,
  previous_version TEXT,
  new_version TEXT NOT NULL,
  action TEXT NOT NULL,
  operator TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lut_uuid) REFERENCES lut_records(uuid)
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lut_uuid TEXT,
  operation_type TEXT NOT NULL,
  status_before TEXT,
  status_after TEXT,
  operator TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lut_uuid) REFERENCES lut_records(uuid)
);

CREATE TABLE IF NOT EXISTS conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lut_uuid TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  conflict_details TEXT NOT NULL,
  resolved BOOLEAN DEFAULT 0,
  resolved_by TEXT,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lut_uuid) REFERENCES lut_records(uuid)
);

CREATE INDEX IF NOT EXISTS idx_lut_hash ON lut_records(file_hash);
CREATE INDEX IF NOT EXISTS idx_lut_project ON lut_records(project_id);
CREATE INDEX IF NOT EXISTS idx_lut_scene ON lut_records(scene_id);
CREATE INDEX IF NOT EXISTS idx_version_lut ON version_history(lut_uuid);
CREATE INDEX IF NOT EXISTS idx_logs_lut ON operation_logs(lut_uuid);
`;

module.exports = { createTables };
