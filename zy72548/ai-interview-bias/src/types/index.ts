export type Role = 'product_manager' | 'operation_reviewer' | 'admin';

export type RecordStatus = 
  | 'pending_review'       
  | 'conflict_detected'    
  | 'pm_confirmed'         
  | 'pm_rejected'          
  | 'pending_operation'    
  | 'operation_approved'   
  | 'operation_rejected'   
  | 'finalized';           

export type ConflictType = 
  | 'prompt_version_mismatch'    
  | 'model_version_changed'      
  | 'duplicate_import'           
  | 'conclusion_inconsistent';   

export interface InterviewSample {
  sampleId: string;
  modelVersion: string;
  aiScore: number;
  candidateName: string;
  interviewDate: string;
  position: string;
}

export interface ManualCorrection {
  correctionId: string;
  sampleId: string;
  humanScore: number;
  conclusion: string;
  reason: string;
  correctedBy: string;
  correctedAt: string;
  batchId: string;
}

export interface PromptVersion {
  versionId: string;
  versionNumber: string;
  description: string;
  effectiveDate: string;
  importedBy: string;
  importedAt: string;
}

export interface ConflictEvidence {
  conflictId: string;
  type: ConflictType;
  sampleId: string;
  description: string;
  fieldA?: string;
  valueA?: string;
  fieldB?: string;
  valueB?: string;
  detectedAt: string;
  resolved?: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: 'confirm' | 'reject' | 'operation_review';
}

export interface HistoryRecord {
  historyId: string;
  recordId: string;
  sampleId: string;
  action: string;
  operator: string;
  role: Role;
  timestamp: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  remark?: string;
}

export interface ReviewRecord {
  recordId: string;
  sampleId: string;
  interview: InterviewSample;
  correction?: ManualCorrection;
  promptVersion?: PromptVersion;
  status: RecordStatus;
  conflicts: ConflictEvidence[];
  history: HistoryRecord[];
  createdAt: string;
  updatedAt: string;
  finalConclusion?: string;
  finalScore?: number;
}

export interface SelfCheckResult {
  checkId: string;
  checkName: string;
  passed: boolean;
  message: string;
  details?: string[];
  checkedAt: string;
}

export interface AppState {
  currentRole: Role;
  currentUser: string;
  reviewRecords: ReviewRecord[];
  promptVersions: PromptVersion[];
  selectedRecordId?: string;
  activeTab: 'import' | 'review' | 'replay' | 'selfcheck';
}
