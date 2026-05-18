export enum SkipApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DOWNSTREAM_EXCEPTION = 'downstream_exception',
  RERUN_COMPLETED = 'rerun_completed'
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export enum RerunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed'
}

export interface SkipApplication {
  id: string;
  workflow_id: string;
  task_id: string;
  task_name: string;
  skip_reason: string;
  impact_scope: string;
  rerun_plan: string;
  applicant: string;
  status: SkipApplicationStatus;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRecord {
  id: string;
  skip_application_id: string;
  approver: string;
  approval_result: 'approved' | 'rejected';
  approval_comment?: string;
  approved_at: string;
}

export interface WorkflowRecord {
  id: string;
  workflow_id: string;
  task_id: string;
  task_name: string;
  status: TaskStatus;
  is_skipped: number;
  skip_application_id?: string;
  downstream_tasks?: string;
  data_completeness?: 'complete' | 'incomplete';
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface RerunRecord {
  id: string;
  skip_application_id: string;
  workflow_record_id?: string;
  rerun_task_id: string;
  rerun_task_name: string;
  status: RerunStatus;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface CreateSkipApplicationRequest {
  workflow_id: string;
  task_id: string;
  task_name: string;
  skip_reason: string;
  impact_scope: string;
  rerun_plan: string;
  applicant: string;
}

export interface ApproveSkipRequest {
  skip_application_id: string;
  approver: string;
  approval_result: 'approved' | 'rejected';
  approval_comment?: string;
}

export interface ExecuteTaskRequest {
  workflow_id: string;
  task_id: string;
  task_name: string;
  downstream_tasks: string[];
}

export interface ReportDownstreamExceptionRequest {
  workflow_record_id: string;
  skip_application_id: string;
}