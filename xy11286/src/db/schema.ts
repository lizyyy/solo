export const createTablesSQL = `
CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  generic_name TEXT,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  is_controlled INTEGER NOT NULL DEFAULT 0,
  requires_prescription INTEGER NOT NULL DEFAULT 1,
  min_dose REAL,
  max_dose REAL,
  dose_unit TEXT,
  dose_per_weight REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  unit_price REAL NOT NULL,
  manufacture_date TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  supplier TEXT,
  imported_at INTEGER NOT NULL,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  UNIQUE(medicine_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_inventory_medicine ON inventory_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_batches(status);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory_batches(expiry_date);

CREATE TABLE IF NOT EXISTS dosage_rules (
  id TEXT PRIMARY KEY,
  medicine_id TEXT NOT NULL,
  species TEXT NOT NULL,
  min_weight REAL NOT NULL,
  max_weight REAL NOT NULL,
  weight_unit TEXT NOT NULL,
  dosage_amount REAL NOT NULL,
  dosage_unit TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

CREATE INDEX IF NOT EXISTS idx_dosage_medicine ON dosage_rules(medicine_id);
CREATE INDEX IF NOT EXISTS idx_dosage_species ON dosage_rules(species);

CREATE TABLE IF NOT EXISTS pets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT NOT NULL,
  weight REAL NOT NULL,
  weight_unit TEXT NOT NULL,
  age INTEGER,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  prescription_number TEXT UNIQUE NOT NULL,
  doctor_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  pet_id TEXT NOT NULL,
  pet_name TEXT NOT NULL,
  pet_species TEXT NOT NULL,
  pet_weight REAL NOT NULL,
  pet_weight_unit TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  status TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  rejection_reason TEXT,
  block_reason TEXT,
  submitted_at INTEGER,
  reviewed_at INTEGER,
  approved_at INTEGER,
  dispensed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  import_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_prescription_status ON prescriptions(status);
CREATE INDEX IF NOT EXISTS idx_prescription_doctor ON prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescription_pet ON prescriptions(pet_id);
CREATE INDEX IF NOT EXISTS idx_prescription_created ON prescriptions(created_at);

CREATE TABLE IF NOT EXISTS prescription_items (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  batch_id TEXT,
  batch_number TEXT,
  requested_quantity REAL NOT NULL,
  dispensed_quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  dosage TEXT NOT NULL,
  dosage_calculation TEXT,
  notes TEXT,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id),
  FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  FOREIGN KEY (batch_id) REFERENCES inventory_batches(id)
);

CREATE INDEX IF NOT EXISTS idx_item_prescription ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_item_medicine ON prescription_items(medicine_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

CREATE TABLE IF NOT EXISTS import_sessions (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL,
  source_file TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  operator_id TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  UNIQUE(import_type, file_hash)
);

CREATE TABLE IF NOT EXISTS bad_records (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL,
  import_type TEXT NOT NULL,
  source_file TEXT NOT NULL,
  row_number INTEGER NOT NULL,
  column_name TEXT,
  original_data TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  suggested_fix TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolved_at INTEGER,
  resolved_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (import_id) REFERENCES import_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_bad_import ON bad_records(import_id);
CREATE INDEX IF NOT EXISTS idx_bad_resolved ON bad_records(resolved);

CREATE TABLE IF NOT EXISTS sensitive_field_configs (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  field TEXT NOT NULL,
  mask_type TEXT NOT NULL,
  mask_pattern TEXT,
  export_masked INTEGER NOT NULL DEFAULT 1,
  log_masked INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE(entity, field)
);
`;