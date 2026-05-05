-- 入库批次表
CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_name TEXT NOT NULL,
  upload_date TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, cancelled
  total_items INTEGER DEFAULT 0,
  confirmed_items INTEGER DEFAULT 0,
  cancelled_items INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 藏品状态表
CREATE TABLE IF NOT EXISTS artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL,
  box_number TEXT, -- 箱号
  artifact_number TEXT NOT NULL, -- 藏品号
  insurance_value REAL DEFAULT 0, -- 保险值
  location TEXT, -- 库位
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, returned, missing
  has_certificate BOOLEAN DEFAULT 0, -- 是否有证
  original_row INTEGER, -- 原始行号
  notes TEXT,
  validation_errors TEXT, -- 验证错误（JSON格式）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER,
  artifact_id INTEGER,
  action TEXT NOT NULL, -- upload, validate, confirm, cancel, update, export
  user_name TEXT, -- 操作人（暂未实现用户系统）
  details TEXT, -- 操作详情（JSON格式）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_artifacts_batch_id ON artifacts(batch_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_artifact_number ON artifacts(artifact_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_batch_id ON audit_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
