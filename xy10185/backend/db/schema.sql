PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sequence INTEGER NOT NULL,
  planned_date TEXT,
  actual_date TEXT,
  status TEXT DEFAULT 'pending',
  payment_percentage REAL DEFAULT 0,
  payment_amount REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deliverables (
  id TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT NOT NULL,
  file_name TEXT,
  file_path TEXT,
  file_size INTEGER,
  uploader TEXT,
  status TEXT DEFAULT 'submitted',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS acceptance_records (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL,
  result TEXT NOT NULL,
  opinion TEXT,
  reviewer TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rework_records (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  expected_date TEXT,
  status TEXT DEFAULT 'pending',
  actual_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_milestone ON deliverables(milestone_id);
CREATE INDEX IF NOT EXISTS idx_acceptance_deliverable ON acceptance_records(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_rework_deliverable ON rework_records(deliverable_id);