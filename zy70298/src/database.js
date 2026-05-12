const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pharmacy.db');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = `
CREATE TABLE IF NOT EXISTS elders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bed_number TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  elder_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  doctor_name TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (elder_id) REFERENCES elders(id)
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT '片',
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
);

CREATE TABLE IF NOT EXISTS pill_boxes (
  id TEXT PRIMARY KEY,
  elder_id TEXT NOT NULL,
  box_label TEXT NOT NULL,
  intended_date DATE NOT NULL,
  status TEXT DEFAULT 'prepared',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (elder_id) REFERENCES elders(id)
);

CREATE TABLE IF NOT EXISTS pill_box_items (
  id TEXT PRIMARY KEY,
  pill_box_id TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT DEFAULT '片',
  FOREIGN KEY (pill_box_id) REFERENCES pill_boxes(id)
);

CREATE TABLE IF NOT EXISTS distributions (
  id TEXT PRIMARY KEY,
  pill_box_id TEXT NOT NULL,
  prescription_id TEXT NOT NULL,
  distributor TEXT,
  distributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending',
  match_score REAL,
  FOREIGN KEY (pill_box_id) REFERENCES pill_boxes(id),
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  distribution_id TEXT NOT NULL,
  receipt_type TEXT NOT NULL,
  received_by TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  actual_medicines TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  FOREIGN KEY (distribution_id) REFERENCES distributions(id)
);

CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  data TEXT,
  status TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_elder ON prescriptions(elder_id, status);
CREATE INDEX IF NOT EXISTS idx_pill_boxes_elder ON pill_boxes(elder_id, intended_date);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
`;

db.exec(schema);

module.exports = db;
