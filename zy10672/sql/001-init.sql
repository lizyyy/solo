CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE command_status AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTING',
  'TERMINATED',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

CREATE TYPE approval_action AS ENUM (
  'SUBMIT',
  'APPROVE',
  'REJECT',
  'START_EXECUTE',
  'TERMINATE',
  'COMPLETE',
  'FAIL',
  'MANUAL_REMARK',
  'CONTINUE_AFTER_EXPIRED'
);

CREATE TYPE import_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED'
);

CREATE TABLE host_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  hosts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE approvers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  user_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  approval_level INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE batch_commands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  command TEXT NOT NULL,
  host_group_id UUID NOT NULL REFERENCES host_groups(id),
  status command_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  execution_window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  execution_window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  submitter_id VARCHAR(255) NOT NULL,
  submitter_name VARCHAR(255) NOT NULL,
  required_approval_count INTEGER NOT NULL DEFAULT 1,
  current_approval_count INTEGER NOT NULL DEFAULT 0,
  is_expired_handled BOOLEAN DEFAULT FALSE,
  expired_remark TEXT,
  total_hosts INTEGER NOT NULL DEFAULT 0,
  success_hosts INTEGER NOT NULL DEFAULT 0,
  failed_hosts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE command_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  command_id UUID NOT NULL REFERENCES batch_commands(id),
  approver_id VARCHAR(255) NOT NULL,
  approver_name VARCHAR(255) NOT NULL,
  approval_level INTEGER NOT NULL DEFAULT 1,
  is_approved BOOLEAN NOT NULL,
  remark TEXT,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(command_id, approver_id)
);

CREATE TABLE execution_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  command_id UUID NOT NULL REFERENCES batch_commands(id),
  host_address VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  agent_executed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  command_id UUID REFERENCES batch_commands(id),
  action approval_action NOT NULL,
  operator_id VARCHAR(255) NOT NULL,
  operator_name VARCHAR(255) NOT NULL,
  from_status command_status,
  to_status command_status,
  remark TEXT,
  change_details JSONB,
  ip_address VARCHAR(255),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE import_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_batch_id VARCHAR(255) UNIQUE NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  status import_status NOT NULL DEFAULT 'PENDING',
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  error_details JSONB DEFAULT '[]'::jsonb,
  imported_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_batch_commands_status ON batch_commands(status);
CREATE INDEX idx_batch_commands_request_id ON batch_commands(request_id);
CREATE INDEX idx_batch_commands_execution_window ON batch_commands(execution_window_start, execution_window_end);
CREATE INDEX idx_command_approvals_command_id ON command_approvals(command_id);
CREATE INDEX idx_audit_logs_command_id ON audit_logs(command_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_execution_records_command_id ON execution_records(command_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_host_groups_updated_at BEFORE UPDATE ON host_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approvers_updated_at BEFORE UPDATE ON approvers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batch_commands_updated_at BEFORE UPDATE ON batch_commands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
