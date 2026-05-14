export const createTables = `
CREATE TABLE IF NOT EXISTS validation_batches (
  id TEXT PRIMARY KEY,
  batch_name TEXT NOT NULL,
  department TEXT NOT NULL,
  total_files INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  manually_corrected_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
);

CREATE TABLE IF NOT EXISTS file_records (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  supplier_code TEXT,
  supplier_name TEXT,
  department TEXT,
  upload_time DATETIME NOT NULL,
  uploader TEXT NOT NULL,
  original_supplier_code TEXT,
  original_supplier_name TEXT,
  FOREIGN KEY (batch_id) REFERENCES validation_batches(id)
);

CREATE TABLE IF NOT EXISTS validation_results (
  id TEXT PRIMARY KEY,
  file_record_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  field_name TEXT,
  status TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  error_message TEXT,
  expected_value TEXT,
  actual_value TEXT,
  checked_at DATETIME NOT NULL,
  FOREIGN KEY (file_record_id) REFERENCES file_records(id),
  FOREIGN KEY (batch_id) REFERENCES validation_batches(id)
);

CREATE TABLE IF NOT EXISTS failed_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  file_record_id TEXT NOT NULL,
  validation_result_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  field_name TEXT,
  error_message TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  file_name TEXT NOT NULL,
  supplier_code TEXT,
  supplier_name TEXT,
  department TEXT,
  created_at DATETIME NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT 0,
  resolved_at DATETIME,
  resolver TEXT,
  FOREIGN KEY (batch_id) REFERENCES validation_batches(id),
  FOREIGN KEY (file_record_id) REFERENCES file_records(id),
  FOREIGN KEY (validation_result_id) REFERENCES validation_results(id)
);

CREATE TABLE IF NOT EXISTS correction_records (
  id TEXT PRIMARY KEY,
  file_record_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  corrected_by TEXT NOT NULL,
  correction_reason TEXT NOT NULL,
  correction_time DATETIME NOT NULL,
  risk_level TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  FOREIGN KEY (file_record_id) REFERENCES file_records(id),
  FOREIGN KEY (batch_id) REFERENCES validation_batches(id)
);

CREATE TABLE IF NOT EXISTS rollback_candidates (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  file_record_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  supplier_code TEXT,
  reason TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT 0,
  approved_by TEXT,
  approved_at DATETIME,
  FOREIGN KEY (batch_id) REFERENCES validation_batches(id),
  FOREIGN KEY (file_record_id) REFERENCES file_records(id)
);

CREATE TABLE IF NOT EXISTS supplier_directory (
  supplier_code TEXT PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  department TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_failed_items_batch ON failed_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_failed_items_risk ON failed_items(risk_level);
CREATE INDEX IF NOT EXISTS idx_validation_results_batch ON validation_results(batch_id);
CREATE INDEX IF NOT EXISTS idx_correction_records_batch ON correction_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_rollback_candidates_batch ON rollback_candidates(batch_id);
`;

export const insertSupplierDirectoryData = `
INSERT OR IGNORE INTO supplier_directory (supplier_code, supplier_name, department, is_active, created_at, updated_at) VALUES
('SUP001', '北京图像科技有限公司', '市场部', 1, '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
('SUP002', '上海视觉传媒有限公司', '市场部', 1, '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
('SUP003', '广州创意设计工作室', '设计部', 1, '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
('SUP004', '深圳高峰图片社', '审核部', 1, '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
('SUP005', '杭州影像制作中心', '生产部', 1, '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
('SUP006', '成都摄影艺术公司', '市场部', 1, '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
('SUP007', '武汉数码冲印中心', '生产部', 1, '2024-01-01 00:00:00', '2024-01-01 00:00:00'),
('SUP008', '南京图片处理工作室', '审核部', 1, '2024-01-01 00:00:00', '2024-01-01 00:00:00');
`;
