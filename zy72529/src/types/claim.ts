export type RecordStatus =
  | 'pending_import'
  | 'pending_review'
  | 'pending_verify'
  | 'conflict'
  | 'completed';

export type EvidenceSource = 'manual_judgment' | 'prompt_version';

export type ResultType = 'success' | 'duplicate' | 'old_criteria' | 'conflict';

export interface EvidenceItem {
  id: string;
  source: EvidenceSource;
  field: string;
  value: string;
  timestamp: string;
  operator: string;
  remark?: string;
}

export interface ConflictItem {
  id: string;
  field: string;
  manualValue: string;
  promptValue: string;
  resolution?: 'confirm_manual' | 'confirm_prompt' | 'reject_both';
}

export interface TimelineNode {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  description: string;
  source?: EvidenceSource;
}

export interface ClaimRecord {
  id: string;
  userId: string;
  userName: string;
  materialType: string;
  submitTime: string;
  status: RecordStatus;
  resultType?: ResultType;
  finalConclusion?: string;

  manualJudgment?: {
    importedAt: string;
    operator: string;
    conclusion: string;
    evidences: EvidenceItem[];
  };

  promptVersion?: {
    reviewedAt: string;
    operator: string;
    version: string;
    conclusion: string;
    evidences: EvidenceItem[];
    isOldCriteria?: boolean;
  };

  conflicts?: ConflictItem[];

  isDuplicateUser?: boolean;
  duplicateRecordIds?: string[];

  timeline: TimelineNode[];

  verification?: {
    verifiedAt?: string;
    verifier?: string;
    result?: 'approved' | 'rejected';
    remark?: string;
  };
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending_import: '待导入',
  pending_review: '待补看',
  pending_verify: '待复核',
  conflict: '有冲突',
  completed: '已完成',
};

export const RESULT_TYPE_LABELS: Record<ResultType, string> = {
  success: '顺利通过',
  duplicate: '重复计入待复核',
  old_criteria: '旧口径补录',
  conflict: '数据冲突',
};

export const SOURCE_LABELS: Record<EvidenceSource, string> = {
  manual_judgment: '人工改判表',
  prompt_version: '提示词版本号',
};
