export enum ExportRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed"
}

export enum VerificationStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  FAILED = "failed",
  PARTIAL = "partial"
}

export interface LogTopic {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface EventRange {
  id: string;
  topic_id: string;
  start_time: string;
  end_time: string;
  start_event_id?: string;
  end_event_id?: string;
  event_count: number;
  created_at: string;
}

export interface HashChain {
  id: string;
  topic_id: string;
  event_id: string;
  event_timestamp: string;
  previous_hash: string;
  current_hash: string;
  event_content_hash: string;
  chain_sequence: number;
  created_at: string;
}

export interface ExportRequest {
  id: string;
  topic_id: string;
  range_id: string;
  requester: string;
  reason: string;
  status: ExportRequestStatus;
  approver?: string;
  approval_comment?: string;
  approved_at?: string;
  idempotency_key: string;
  original_input: Record<string, any>;
  processing_evidence?: Record<string, any>;
  failure_reason?: string;
  final_conclusion?: string;
  created_at: string;
  updated_at: string;
}

export interface VerificationResult {
  id: string;
  request_id: string;
  range_id: string;
  status: VerificationStatus;
  hash_chain_valid: boolean;
  first_hash: string;
  last_hash: string;
  verified_count: number;
  total_count: number;
  mismatch_details?: any[];
  verified_at: string;
  verified_by: string;
}

export interface ProofReport {
  id: string;
  request_id: string;
  verification_id: string;
  report_content: any;
  file_path?: string;
  file_format: "json" | "csv";
  generated_at: string;
}

export interface AuditLogEvent {
  id: string;
  topic_id: string;
  event_type: string;
  actor: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  timestamp: string;
  created_at: string;
}

export interface ProcessingHistory {
  id: string;
  request_id: string;
  action: string;
  actor: string;
  details: Record<string, any>;
  timestamp: string;
}
