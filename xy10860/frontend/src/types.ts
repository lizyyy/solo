export enum ReleaseStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DEPLOYING = 'deploying',
  DEPLOYED = 'deployed',
  ROLLED_BACK = 'rolled_back',
  TIMEOUT = 'timeout'
}

export enum EnvironmentType {
  DEV = 'dev',
  TEST = 'test',
  STAGING = 'staging',
  PROD = 'prod'
}

export enum CheckItemStatus {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface Approval {
  id: number;
  release_order_id: number;
  approver: string;
  comment?: string;
  approved?: boolean;
  approved_at?: string;
  created_at: string;
}

export interface CheckItem {
  id: number;
  release_order_id: number;
  name: string;
  description?: string;
  status: CheckItemStatus;
  checked_by?: string;
  checked_at?: string;
  created_at: string;
}

export interface ReleaseToken {
  id: number;
  release_order_id: number;
  token: string;
  issued_by: string;
  issued_at: string;
  expires_at: string;
  used: boolean;
  used_at?: string;
  is_valid: boolean;
}

export interface RollbackRecord {
  id: number;
  release_order_id: number;
  reason: string;
  rolled_back_by: string;
  rolled_back_at: string;
  previous_version?: string;
}

export interface TimelineEvent {
  id: number;
  release_order_id: number;
  event_type: string;
  description: string;
  created_by?: string;
  created_at: string;
}

export interface ReleaseOrder {
  id: number;
  title: string;
  description?: string;
  version?: string;
  environment: EnvironmentType;
  status: ReleaseStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  scheduled_at?: string;
  timeout_hours: number;
  deployed_at?: string;
  approvals: Approval[];
  check_items: CheckItem[];
  tokens: ReleaseToken[];
  rollback_records: RollbackRecord[];
  timeline: TimelineEvent[];
}

export interface ReleaseOrderCreate {
  title: string;
  description?: string;
  version?: string;
  environment: EnvironmentType;
  created_by: string;
  scheduled_at?: string;
  timeout_hours?: number;
  check_items?: { name: string; description?: string }[];
  approvers?: string[];
}

export interface StatusTransition {
  target_status: ReleaseStatus;
  comment?: string;
  operator: string;
}

export interface ReleaseTokenCreate {
  issued_by: string;
  expires_hours: number;
}

export interface RollbackRecordCreate {
  reason: string;
  rolled_back_by: string;
  previous_version?: string;
}
