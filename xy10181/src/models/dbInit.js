const db = require('../config/database');
const { ApprovalStatus, ApprovalAction, QuotaActionType } = require('../utils/constants');

const initTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS quotas (
      id SERIAL PRIMARY KEY,
      quota_code VARCHAR(64) UNIQUE NOT NULL,
      quota_name VARCHAR(128) NOT NULL,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      used_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      occupied_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      available_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      effective_start_date TIMESTAMP,
      effective_end_date TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      version INTEGER NOT NULL DEFAULT 1
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS approval_records (
      id SERIAL PRIMARY KEY,
      request_id VARCHAR(64) UNIQUE NOT NULL,
      quota_id INTEGER NOT NULL REFERENCES quotas(id),
      quota_code VARCHAR(64) NOT NULL,
      apply_amount DECIMAL(18,2) NOT NULL,
      applicant VARCHAR(128) NOT NULL,
      reason TEXT,
      status VARCHAR(32) NOT NULL DEFAULT '${ApprovalStatus.PENDING}',
      approval_comments TEXT,
      approver VARCHAR(128),
      expired_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS quota_operations (
      id SERIAL PRIMARY KEY,
      quota_id INTEGER NOT NULL REFERENCES quotas(id),
      quota_code VARCHAR(64) NOT NULL,
      approval_record_id INTEGER REFERENCES approval_records(id),
      request_id VARCHAR(64),
      operation_type VARCHAR(32) NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      operator VARCHAR(128),
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      audit_type VARCHAR(64) NOT NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(64),
      action VARCHAR(64) NOT NULL,
      before_data JSONB,
      after_data JSONB,
      operator VARCHAR(128),
      ip_address VARCHAR(64),
      user_agent VARCHAR(256),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_approval_records_request_id ON approval_records(request_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_approval_records_quota_id ON approval_records(quota_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_approval_records_status ON approval_records(status)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_approval_records_expired_at ON approval_records(expired_at)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_quota_operations_quota_id ON quota_operations(quota_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_quota_operations_request_id ON quota_operations(request_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)
  `);
};

const initTriggers = async () => {
  await db.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql'
  `);

  await db.query(`
    DROP TRIGGER IF EXISTS update_quotas_updated_at ON quotas
  `);

  await db.query(`
    CREATE TRIGGER update_quotas_updated_at BEFORE UPDATE ON quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `);

  await db.query(`
    DROP TRIGGER IF EXISTS update_approval_records_updated_at ON approval_records
  `);

  await db.query(`
    CREATE TRIGGER update_approval_records_updated_at BEFORE UPDATE ON approval_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `);
};

const initSampleData = async () => {
  const result = await db.query('SELECT COUNT(*) as count FROM quotas');
  if (result.rows[0].count == 0) {
    await db.query(`
      INSERT INTO quotas (quota_code, quota_name, total_amount, available_amount, is_active, effective_start_date)
      VALUES 
      ('QUOTA_001', '年度采购限额', 1000000.00, 1000000.00, TRUE, CURRENT_TIMESTAMP),
      ('QUOTA_002', '项目A专项限额', 500000.00, 500000.00, TRUE, CURRENT_TIMESTAMP),
      ('QUOTA_003', '差旅费用限额', 100000.00, 100000.00, TRUE, CURRENT_TIMESTAMP)
    `);
  }
};

module.exports = {
  initTables,
  initTriggers,
  initSampleData,
};
