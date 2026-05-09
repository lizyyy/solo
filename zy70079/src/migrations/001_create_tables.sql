-- 候选人表
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 背调任务表
CREATE TABLE IF NOT EXISTS background_check_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  description TEXT,
  third_party_provider VARCHAR(100),
  third_party_reference_id VARCHAR(255),
  retry_count INTEGER NOT NULL DEFAULT 0,
  timeout_at TIMESTAMPTZ,
  decision VARCHAR(50),
  decision_reason TEXT,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 材料版本表
CREATE TABLE IF NOT EXISTS material_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES background_check_tasks(id),
  version INTEGER NOT NULL DEFAULT 1,
  material_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  uploaded_by UUID,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 第三方回执表
CREATE TABLE IF NOT EXISTS third_party_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES background_check_tasks(id),
  provider_name VARCHAR(100) NOT NULL,
  reference_id VARCHAR(255),
  receipt_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  raw_data JSONB,
  summary TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 风险标签表
CREATE TABLE IF NOT EXISTS risk_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES background_check_tasks(id),
  tag_name VARCHAR(100) NOT NULL,
  risk_level VARCHAR(50) NOT NULL,
  description TEXT,
  source VARCHAR(100),
  created_by UUID,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES background_check_tasks(id),
  candidate_id UUID REFERENCES candidates(id),
  action VARCHAR(100) NOT NULL,
  actor UUID,
  actor_type VARCHAR(50),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tasks_candidate ON background_check_tasks(candidate_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON background_check_tasks(status);
CREATE INDEX IF NOT EXISTS idx_materials_task ON material_versions(task_id);
CREATE INDEX IF NOT EXISTS idx_receipts_task ON third_party_receipts(task_id);
CREATE INDEX IF NOT EXISTS idx_risks_task ON risk_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_timeout ON background_check_tasks(timeout_at) WHERE status = 'sent_to_third_party';
