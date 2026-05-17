export enum CommandStatus {
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  EXECUTING = 'EXECUTING',
  TERMINATED = 'TERMINATED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED'
}

export enum ApprovalAction {
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  START_EXECUTE = 'START_EXECUTE',
  TERMINATE = 'TERMINATE',
  COMPLETE = 'COMPLETE',
  FAIL = 'FAIL',
  MANUAL_REMARK = 'MANUAL_REMARK',
  CONTINUE_AFTER_EXPIRED = 'CONTINUE_AFTER_EXPIRED'
}

export enum ImportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  FAILED = 'FAILED'
}

export interface HostGroup {
  id: string;
  name: string;
  description?: string;
  hosts: HostInfo[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  is_deleted: boolean;
}

export interface HostInfo {
  ip: string;
  hostname?: string;
  os?: string;
}

export interface Approver {
  id: string;
  user_id: string;
  user_name: string;
  email?: string;
  approval_level: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BatchCommand {
  id: string;
  request_id: string;
  title: string;
  command: string;
  host_group_id: string;
  status: CommandStatus;
  execution_window_start: Date;
  execution_window_end: Date;
  submitter_id: string;
  submitter_name: string;
  required_approval_count: number;
  current_approval_count: number;
  is_expired_handled: boolean;
  expired_remark?: string;
  total_hosts: number;
  success_hosts: number;
  failed_hosts: number;
  created_at: Date;
  updated_at: Date;
}

export interface CommandApproval {
  id: string;
  command_id: string;
  approver_id: string;
  approver_name: string;
  approval_level: number;
  is_approved: boolean;
  remark?: string;
  approved_at: Date;
}

export interface ExecutionRecord {
  id: string;
  command_id: string;
  host_address: string;
  status: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  started_at?: Date;
  finished_at?: Date;
  agent_executed: boolean;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  command_id?: string;
  action: ApprovalAction;
  operator_id: string;
  operator_name: string;
  from_status?: CommandStatus;
  to_status?: CommandStatus;
  remark?: string;
  change_details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface ImportRecord {
  id: string;
  import_batch_id: string;
  file_name: string;
  status: ImportStatus;
  total_rows: number;
  success_rows: number;
  failed_rows: number;
  error_details: ImportError[];
  imported_by: string;
  created_at: Date;
  completed_at?: Date;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  data?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  suggestion: string;
}

export type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_REQUEST'
  | 'INVALID_STATE_TRANSITION'
  | 'EXECUTION_WINDOW_EXPIRED'
  | 'APPROVAL_REQUIRED'
  | 'NOT_FOUND'
  | 'HOST_GROUP_NOT_FOUND'
  | 'INSUFFICIENT_PERMISSION'
  | 'IMPORT_ERROR'
  | 'IDEMPOTENT_CONFLICT'
  | 'AGENT_EXECUTION_ABNORMAL'
  | 'MANUAL_INTERVENTION_REQUIRED';
